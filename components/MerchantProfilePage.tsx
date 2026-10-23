import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Settings, Supplier, MerchantTransaction, Order, Treasury, CustomerProfile } from '../types';
import { 
  Trash2, Printer, Wallet as WalletIcon, RefreshCw, 
  CheckCircle2, Clock, Eye, Search, Lock, Share2, Copy, Sparkles, X, Mail,
  Calculator, ExternalLink, ChevronDown, ChevronUp, AlertCircle, ShieldCheck, Key,
  Layers, FileText, ArrowLeft, Building2, Truck, ArrowDownRight, Package as PackageIcon, TrendingUp, Coins, Activity, History
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import * as db from '../services/databaseService';
import { calculateMerchantTransparencyAnalytics } from '../utils/merchantAnalytics';
import { inAppToast, inAppConfirm, inAppAlert } from '../utils/inAppAlert';
import { BulkOrderSettlementModal } from './BulkOrderSettlementModal';

interface MerchantProfilePageProps {
  settings: Settings;
  updateSettings: (updater: (prev: Settings) => Settings) => void;
  orders: Order[];
  setOrders?: React.Dispatch<React.SetStateAction<Order[]>>;
  treasury?: Treasury;
  setTreasury?: (updater: (prev: Treasury | undefined) => Treasury | undefined) => void;
  customers?: CustomerProfile[];
  currentUser?: any;
}

const normalizeName = (name: string): string => {
  if (!name) return '';
  let normalized = name.trim().replace(/\s+/g, ' ');
  normalized = normalized.replace(/\s*\((موكل|مورد|صاحب بضاعة|تاجر|partner|employee|admin)\)/gi, '');
  return normalized
    .replace(/أ/g, 'ا')
    .replace(/إ/g, 'ا')
    .replace(/آ/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .trim();
};

const MerchantProfilePage: React.FC<MerchantProfilePageProps> = ({ 
  settings, 
  updateSettings, 
  orders, 
  setOrders,
  treasury, 
  setTreasury,
  customers = [],
  currentUser
}) => {
  const { storeId, supplierId } = useParams<{ storeId: string; supplierId: string }>();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'settlements' | 'inventory' | 'requests'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [merchantPinInput, setMerchantPinInput] = useState('');
  const [cloudRequests, setCloudRequests] = useState<db.PartnerPortalRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);

  // Direct Financial Transactions & Approval Modal States
  const [showDirectTxModal, setShowDirectTxModal] = useState(false);
  const [directTxType, setDirectTxType] = useState<'withdrawal' | 'expense' | 'deposit'>('withdrawal');
  const [directTxAmount, setDirectTxAmount] = useState('');
  const [directTxNotes, setDirectTxNotes] = useState('');
  const [directTxRef, setDirectTxRef] = useState('');
  const [directTxTreasuryId, setDirectTxTreasuryId] = useState('');
  const [selectedReqForApproval, setSelectedReqForApproval] = useState<db.PartnerPortalRequest | null>(null);
  const [approvalTreasuryAccountId, setApprovalTreasuryAccountId] = useState('');
  const [approvalTransferRef, setApprovalTransferRef] = useState('');
  const [approvalReceiptImage, setApprovalReceiptImage] = useState('');
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

  // Find the merchant (supplier)
  const merchant = useMemo(() => {
    const rawSuppliers = settings.suppliers || [];
    const targetId = supplierId?.toLowerCase() || '';
    const targetName = normalizeName(supplierId || '');

    return rawSuppliers.find(s => 
      (s.id && s.id.toLowerCase() === targetId) || 
      (s.id && s.id.toLowerCase() === targetId.replace('sup_', '')) ||
      (normalizeName(s.name) === targetName)
    );
  }, [settings.suppliers, supplierId]);

  const loadRequests = useCallback(async () => {
    if (!storeId) return;
    setIsLoadingRequests(true);
    try {
      const reqs = await db.getMerchantRequests(storeId);
      setCloudRequests(reqs);
    } catch (err) {
      console.error('[MerchantProfile] Error loading requests:', err);
    } finally {
      setIsLoadingRequests(false);
    }
  }, [storeId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const merchantRequests = useMemo(() => {
    if (!merchant) return [];
    const mId = merchant.id.toLowerCase();
    const mName = normalizeName(merchant.name);
    return cloudRequests.filter(r => {
      const rId = (r.partnerId || (r as any).merchantId || '').toLowerCase();
      const rName = normalizeName(r.partnerName || (r as any).merchantName || '');
      return (rId === mId) || (rName === mName);
    });
  }, [cloudRequests, merchant]);

  const pendingRequests = useMemo(() => 
    merchantRequests.filter(r => r.status === 'pending'), 
    [merchantRequests]
  );

  const merchantOrders = useMemo(() => {
    if (!merchant) return [];
    const mName = normalizeName(merchant.name);
    const mId = merchant.id.toLowerCase();
    return orders.filter(o => {
      const oMId = (o.merchantId || '').toLowerCase();
      const oMName = normalizeName(o.merchantName || '');
      return (oMId === mId) || (oMName === mName);
    });
  }, [orders, merchant]);

  const unsettledOrders = useMemo(() => {
    const eligibleStatuses = [
      'تم_التحصيل', 'مدفوعة', 'تم_التوصيل', 'مرتجع',
      'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_جزئي',
      'مرتجع_بعد_الاستلام', 'ملغي'
    ];
    return merchantOrders.filter(o => o.settlementStatus !== 'settled' && eligibleStatuses.includes(o.status));
  }, [merchantOrders]);

  const analytics = useMemo(() => {
    if (!merchant) return null;
    return calculateMerchantTransparencyAnalytics(merchantOrders, settings, merchant.id);
  }, [merchantOrders, settings, merchant]);

  const chartData = useMemo(() => {
    if (!merchant) return [];
    const transactions = merchant.transactions || [];
    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let runningBalance = 0;
    return sortedTxs.map(t => {
      runningBalance = t.balanceAfter ?? (runningBalance + t.amount);
      return {
        date: new Date(t.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }),
        balance: runningBalance,
        amount: t.amount
      };
    });
  }, [merchant]);

  if (!merchant) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <AlertCircle size={48} className="text-rose-500" />
        <h2 className="text-xl font-black text-slate-800">لم يتم العثور على الموكل المطلوب</h2>
        <button onClick={() => navigate(-1)} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold cursor-pointer hover:bg-indigo-700 transition-colors">العودة للخلف</button>
      </div>
    );
  }

  const handleCustomQuoteAction = async (
    req: db.PartnerPortalRequest,
    mode: 'send_quote' | 'activate_now',
    customFeeInput?: number
  ) => {
    try {
      if (!storeId) return;
      const quotedFee = Math.max(1, Number(customFeeInput ?? customQuoteFeeMap[req.id] ?? 20));
      const baseReqMeta = req.planRequestMeta || merchant.pendingPlanRequest || {};
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
      const currentBal = Number(merchant.balance || 0);

      if (mode === 'activate_now' && isPrepaid && upfrontCharge > currentBal) {
        inAppToast(
          `رصيد محفظة الموكل (${currentBal.toLocaleString()} ج.م) أقل من قيمة الدفع المقدم (${upfrontCharge.toLocaleString()} ج.م). يمكنك إرسال عرض السعر للموكل أولاً.`,
          'error'
        );
        return;
      }

      await db.updateMerchantRequestStatus(req.id, storeId, 'approved');
      setCloudRequests(prev => prev.map(r => (r.id === req.id ? { ...r, status: 'approved' } : r)));

      const nowIso = new Date().toISOString();
      const expIso = new Date(Date.now() + 30 * 86400000).toISOString();
      const newCycleId = `CYC-MGR-CUSTOM-${Date.now()}`;

      updateSettings(currentSettings => {
        const updateItem = (s: any) => {
          if (s.id !== merchant.id && normalizeName(s.name || '') !== normalizeName(merchant.name || '')) return s;
          if (mode === 'send_quote') {
            return {
              ...s,
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

          const nextBal = Number((Number(s.balance || 0) - upfrontCharge).toFixed(2));
          const newTx: MerchantTransaction | undefined =
            upfrontCharge > 0
              ? {
                  id: `mtx-custom-${Date.now()}`,
                  merchantId: s.id,
                  merchantName: s.name,
                  date: nowIso,
                  type: 'subscription_charge',
                  amount: -upfrontCharge,
                  balanceAfter: nextBal,
                  notes: `تفعيل باقة المدير المخصصة (${quotedFee} ج.م/أوردر - ${targetOrders} أوردر)`
                }
              : undefined;

          return {
            ...s,
            subscriptionPlan: {
              ...(s.subscriptionPlan || {}),
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
            ...(newTx ? { transactions: [newTx, ...(s.transactions || [])] } : {})
          };
        };

        const updatedSuppliers = (currentSettings.suppliers || []).map(updateItem);
        if (storeId) {
          db.updatePartnerSettings(storeId, currentSettings.partners || [], updatedSuppliers).catch(() => {});
        }
        return {
          ...currentSettings,
          suppliers: updatedSuppliers,
        };
      });

      setSelectedReqForApproval(null);
      inAppToast(
        mode === 'send_quote'
          ? `تم إرسال عرض السعر (${quotedFee} ج.م / أوردر) لبوابة الموكل ${merchant.name} بنجاح 📤`
          : `تم تفعيل الباقة المخصصة للموكل ${merchant.name} بسعر (${quotedFee} ج.م / أوردر) فوراً بدون اشتراط رصيد مقدم ⚡`,
        'success'
      );
    } catch (err: any) {
      inAppToast('حدث خطأ أثناء معالجة طلب التسعير: ' + (err.message || ''), 'error');
    }
  };

  // 1. Approve Request with optional central Treasury Deduction
  const handleApproveRequest = async (req: db.PartnerPortalRequest, treasuryAccountId?: string) => {
    try {
      if (req.type === 'custom_plan_quote') {
        await handleCustomQuoteAction(req, 'activate_now');
        return;
      }
      const amount = Number(req.amount);
      if (!storeId || req.status !== 'pending' || !Number.isFinite(amount) || (req.type !== 'plan_change_request' && amount <= 0)) {
        inAppToast('تعذر اعتماد الطلب: المبلغ غير صالح.', 'error');
        return;
      }

      const isRefundRequest = req.type === 'subscription_refund';
      const isTopUpRequest = req.type === 'wallet_topup';
      const isCreditToWallet = isRefundRequest || isTopUpRequest;

      if (!isCreditToWallet && amount > (merchant.balance || 0)) {
        inAppToast(`مبلغ السحب (${amount.toLocaleString()} ج.م) يتجاوز رصيد محفظة الموكل (${(merchant.balance || 0).toLocaleString()} ج.م)`, 'error');
        return;
      }

      const selectedAcc = (treasury?.accounts || []).find(a => a.id === treasuryAccountId);
      if (!isCreditToWallet && selectedAcc && selectedAcc.balance < amount) {
        inAppToast(`رصيد حساب الخزينة (${selectedAcc.name}) غير كافٍ لصرف هذا الطلب (${selectedAcc.balance.toLocaleString()} ج.م)`, 'error');
        return;
      }

      const cleanRef = approvalTransferRef.trim() || undefined;
      const cleanImg = approvalReceiptImage || undefined;

      const statusUpdated = await db.updateMerchantRequestStatus(req.id, storeId, 'approved', {
        receiptImage: cleanImg,
        transferReference: cleanRef
      });
      if (!statusUpdated) {
        inAppToast('لم يتم اعتماد الطلب؛ ربما عولج بالفعل من شاشة أخرى. حدّث القائمة.', 'error');
        return;
      }
      setCloudRequests(prev => prev.map(r => r.id === req.id ? {
        ...r,
        status: 'approved',
        ...(cleanImg ? { receiptImage: cleanImg } : {}),
        ...(cleanRef ? { transferReference: cleanRef } : {})
      } : r));

      // Deduct from central Treasury if selected (only for withdrawals)
      if (!isCreditToWallet && selectedAcc && setTreasury && treasury) {
        const treasuryTx = {
          id: `tx-${Date.now()}`,
          date: new Date().toISOString(),
          amount,
          type: 'withdrawal' as const,
          description: `صرف طلب سحب مستحقات الموكل: ${merchant.name} (طلب #${req.id.slice(-6)})${cleanRef ? ` - مرجع: ${cleanRef}` : ''}`,
          fromAccountId: selectedAcc.id,
          operatorName: currentUser?.fullName || 'الإدارة',
          reference: cleanRef || req.id
        };

        setTreasury(current => current ? ({
          ...current,
          accounts: current.accounts.map(acc => acc.id === selectedAcc.id
            ? { ...acc, balance: acc.balance - amount }
            : acc),
          transactions: [treasuryTx, ...(current.transactions || [])]
        }) : current);
      }

      // Update Merchant Balance and record Transaction
      updateSettings(currentSettings => {
        const updatedSuppliers = (currentSettings.suppliers || []).map(s => {
          if (s.id === merchant.id) {
            const currentBalance = Number(s.balance || 0);
            const nextBal = isCreditToWallet
              ? Number((currentBalance + amount).toFixed(2))
              : Number((currentBalance - amount).toFixed(2));
            const newTx: MerchantTransaction = {
              id: `mtx-w-${Date.now()}`,
              merchantId: s.id,
              merchantName: s.name,
              date: new Date().toISOString(),
              type: isRefundRequest ? 'subscription_refund' : isTopUpRequest ? 'wallet_topup' : 'withdrawal',
              amount: isCreditToWallet ? amount : -amount,
              balanceAfter: nextBal,
              notes: isRefundRequest
                ? `إيداع استرداد باقة (سياسة 14 يوم) بعد مراجعة الإدارة - ${req.notes || ''}`
                : isTopUpRequest
                ? `شحن محفظة التاجر بعد اعتماد الإدارة - ${req.notes || ''}`
                : `سحب مستحقات (طلب #${req.id.slice(-6)}) ${selectedAcc ? `- صرف من خزينة: ${selectedAcc.name}` : ''}${cleanRef ? ` - مرجع التحويل: ${cleanRef}` : ''} - ${req.notes || ''}`,
              referenceId: req.id,
              receiptImage: cleanImg,
              transferReference: cleanRef,
              performedBy: currentUser?.fullName || 'الإدارة'
            };

            const nextSupplier: any = {
              ...s,
              balance: nextBal,
              transactions: [newTx, ...(s.transactions || [])]
            };

            if (isRefundRequest) {
              const targetType = req.refundMeta?.targetType;
              if (targetType === 'manager' && s.managerPlan) {
                nextSupplier.managerPlan = { ...s.managerPlan, planId: 'none', status: 'refunded', refundedAmount: amount };
              } else if (s.subscriptionPlan) {
                nextSupplier.subscriptionPlan = { ...s.subscriptionPlan, planId: 'free', ordersLimit: 30, status: 'refunded', refundedAmount: amount };
              }
            }
            return nextSupplier;
          }
          return s;
        });
        const addedTx = updatedSuppliers.find(s => s.id === merchant.id)?.transactions?.[0];
        return {
          ...currentSettings,
          suppliers: updatedSuppliers,
          ...(addedTx ? { merchantTransactions: [addedTx, ...(currentSettings.merchantTransactions || [])] } : {})
        };
      });

      setSelectedReqForApproval(null);
      setApprovalTreasuryAccountId('');
      setApprovalTransferRef('');
      setApprovalReceiptImage('');
      inAppToast(
        isRefundRequest
          ? `تم اعتماد استرداد الباقة وإيداع ${amount.toLocaleString()} ج.م في محفظة ${merchant.name} بنجاح ✅`
          : isTopUpRequest
          ? `تم شحن محفظة ${merchant.name} بمبلغ ${amount.toLocaleString()} ج.م بنجاح ✅`
          : `تم اعتماد وصرف طلب السحب للموكل ${merchant.name} بمبلغ ${amount.toLocaleString()} ج.م بنجاح ✅`,
        'success'
      );
    } catch (err: any) {
      inAppToast('حدث خطأ أثناء اعتماد الطلب: ' + (err.message || ''), 'error');
    }
  };

  // 2. Reject Request (Restores / unfreezes amount in merchant's portal immediately)
  const handleRejectRequest = async (req: db.PartnerPortalRequest) => {
    try {
      if (!storeId || req.status !== 'pending') return;
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

      const updated = await db.updateMerchantRequestStatus(req.id, storeId, 'rejected');
      if (!updated) {
        inAppToast('تعذر تحديث حالة الطلب؛ ربما عولج بالفعل.', 'error');
        return;
      }
      setCloudRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'rejected' } : r));
      inAppToast('تم رفض طلب السحب بنجاح وأصبح المبلغ متاحاً بالكامل في محفظة الموكل.', 'info');
    } catch (err: any) {
      inAppToast('حدث خطأ أثناء رفض الطلب', 'error');
    }
  };

  // 3. Direct Manual Transaction (Cash Advance / Direct Payout / Expense / Deposit)
  const handleExecuteDirectTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant) return;
    const amount = Number(directTxAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      inAppToast('يرجى إدخال مبلغ صحيح أكبر من الصفر', 'error');
      return;
    }

    const currentBalance = merchant.balance || 0;
    const selectedAcc = (treasury?.accounts || []).find(a => a.id === directTxTreasuryId);

    if (directTxType === 'withdrawal' && selectedAcc) {
      if (selectedAcc.balance < amount) {
        inAppToast(`رصيد حساب الخزينة (${selectedAcc.name}) غير كافٍ لصرف هذا المبلغ (${selectedAcc.balance.toLocaleString()} ج.م)`, 'error');
        return;
      }
    }

    const isNegativeDelta = directTxType === 'withdrawal' || directTxType === 'expense';
    const delta = isNegativeDelta ? -amount : amount;
    const newBalance = currentBalance + delta;

    const typeLabels: Record<string, string> = {
      withdrawal: 'سحب نقدي مباشر / دفعة تحت الحساب',
      expense: 'خصم مصروفات إضافية',
      deposit: 'إضافة رصيد / إيداع'
    };

    const txTypeMapped: 'withdrawal' | 'adjustment' | 'deposit' = 
      directTxType === 'withdrawal' ? 'withdrawal' : 'adjustment';

    const fullNotes = [
      typeLabels[directTxType],
      directTxNotes.trim(),
      selectedAcc ? `(خزينة: ${selectedAcc.name})` : '',
      directTxRef.trim() ? `مرجع: ${directTxRef.trim()}` : ''
    ].filter(Boolean).join(' - ');

    const newTx: MerchantTransaction = {
      id: `mtx-${Date.now()}`,
      merchantId: merchant.id,
      merchantName: merchant.name,
      date: new Date().toISOString(),
      type: txTypeMapped,
      amount: delta,
      balanceAfter: newBalance,
      notes: fullNotes,
      referenceId: directTxRef.trim() || undefined,
      performedBy: currentUser?.fullName || 'الإدارة'
    };

    // Update central Treasury if selected
    if (selectedAcc && setTreasury && treasury) {
      const treasuryDelta = directTxType === 'withdrawal' ? -amount : (directTxType === 'deposit' ? amount : 0);
      if (treasuryDelta !== 0) {
        const treasuryTx = {
          id: `tx-${Date.now()}`,
          date: new Date().toISOString(),
          amount: Math.abs(treasuryDelta),
          type: directTxType === 'withdrawal' ? ('withdrawal' as const) : ('deposit' as const),
          description: `${typeLabels[directTxType]} للموكل: ${merchant.name} - ${directTxNotes || ''}`,
          fromAccountId: directTxType === 'withdrawal' ? selectedAcc.id : undefined,
          toAccountId: directTxType === 'deposit' ? selectedAcc.id : undefined,
          operatorName: currentUser?.fullName || 'الإدارة',
          reference: directTxRef || undefined
        };

        setTreasury(current => current ? ({
          ...current,
          accounts: current.accounts.map(acc => acc.id === selectedAcc.id
            ? { ...acc, balance: acc.balance + treasuryDelta }
            : acc),
          transactions: [treasuryTx, ...(current.transactions || [])]
        }) : current);
      }
    }

    // Update Merchant and Settings
    updateSettings(currentSettings => {
      const updatedSuppliers = (currentSettings.suppliers || []).map(s => {
        if (s.id === merchant.id) {
          return {
            ...s,
            balance: newBalance,
            transactions: [newTx, ...(s.transactions || [])]
          };
        }
        return s;
      });

      return {
        ...currentSettings,
        suppliers: updatedSuppliers,
        merchantTransactions: [newTx, ...(currentSettings.merchantTransactions || [])]
      };
    });

    setShowDirectTxModal(false);
    setDirectTxAmount('');
    setDirectTxNotes('');
    setDirectTxRef('');
    setDirectTxTreasuryId('');

    inAppToast(`تم تسجيل ${typeLabels[directTxType]} بمبلغ ${amount.toLocaleString()} ج.م وتحديث المحفظة بنجاح ✅`, 'success');
  };

  const copyPortalLink = () => {
    const link = `${window.location.origin}/merchant-portal?storeId=${storeId}&merchantId=${merchant.id}`;
    navigator.clipboard.writeText(link);
    inAppToast('تم نسخ رابط بوابة الموكل بنجاح', 'success');
  };

  const shareWhatsApp = () => {
    const link = `${window.location.origin}/merchant-portal?storeId=${storeId}&merchantId=${merchant.id}`;
    const code = merchant.passcode || '0000';
    const storeTitle = settings.storeName || 'المتجر';
    const text = `مرحباً بك يا ${merchant.name} 🌟\nإليك رابط بوابتك الإلكترونية المباشرة لمتابعة شحنات بضاعتك وتفاصيل محفظتك المالية في متجر ${storeTitle}:\n🔗 ${link}\n🔑 رمز المرور السري (PIN): ${code}\n\nتحياتنا، إدارة المتجر.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      {/* Header Navigation */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate(`/store/${storeId}/merchant-settlement?tab=partners`)} 
          className="group flex items-center gap-2 text-slate-500 font-bold hover:text-emerald-600 transition-colors cursor-pointer"
        >
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:bg-emerald-50 transition-colors border border-slate-200">
            <ArrowLeft size={20} />
          </div>
          العودة لدليل الموكلين
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={() => setShowDirectTxModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black shadow-md transition-all cursor-pointer"
            title="تسجيل سحب نقدي مباشر أو خصم مصاريف أو إيداع بحساب الموكل"
          >
            <Coins size={16} className="text-amber-400" />
            <span className="text-xs">سحب / خصم / إيداع مباشر 💳</span>
          </button>
          <button 
            onClick={() => {
              if (unsettledOrders.length === 0) {
                inAppToast('لا توجد أوردرات جاهزة للتسوية لهذا الموكل حالياً.', 'info');
                return;
              }
              setShowSettlementModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Calculator size={16} />
            <span className="text-xs">تسوية أوردرات الموكل ({unsettledOrders.length}) 💼</span>
          </button>
          <button 
            onClick={copyPortalLink}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black border border-indigo-200 hover:bg-indigo-100 transition-all cursor-pointer"
          >
            <Copy size={16} />
            <span className="text-xs">رابط البوابة</span>
          </button>
          <button 
            onClick={shareWhatsApp}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl font-black border border-emerald-200 hover:bg-emerald-100 transition-all cursor-pointer"
          >
            <Share2 size={16} />
            <span className="text-xs">مشاركة واتساب</span>
          </button>
        </div>
      </div>

      {/* Profile Hero Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-slate-200 flex flex-col md:flex-row items-center gap-6 sm:gap-8 justify-between relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        
        <div className="flex items-center gap-4 sm:gap-6 relative z-10 w-full sm:w-auto">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-tr from-emerald-600 to-teal-700 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/30 flex-shrink-0">
            <Building2 size={48} />
          </div>
          <div className="space-y-1 min-w-0 text-right">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-800 truncate">{merchant.name}</h1>
              <span className="bg-emerald-100 text-emerald-600 text-[10px] font-black px-3 py-1 rounded-full uppercase border border-emerald-200">موكل معتمد</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <p className="text-xs sm:text-sm text-slate-500 font-medium flex items-center gap-2">
                <Truck size={16} className="text-slate-400" />
                <span>{merchantOrders.length} أوردر إجمالي</span>
              </p>
              <p className="text-xs sm:text-sm text-slate-500 font-medium flex items-center gap-2">
                <Mail size={16} className="text-slate-400" />
                <span>{merchant.email || 'بدون بريد مسجل'}</span>
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400">PIN:</span>
                <span className="text-xs font-mono font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg">{merchant.passcode || '0000'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center md:text-left relative z-10 w-full sm:w-auto mt-4 sm:mt-0 bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
          <p className="text-[10px] sm:text-xs font-black text-emerald-600 uppercase tracking-widest mb-1">رصيد الموكل الحالي بالمحفظة</p>
          <p className={`text-4xl sm:text-5xl font-black tracking-tighter ${(merchant.balance || 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
            {(merchant.balance || 0).toLocaleString()} 
            <span className="text-lg sm:text-xl font-bold ml-2 text-emerald-400">ج.م</span>
          </p>
        </div>
      </motion.div>

      {/* Pending Requests Section */}
      {pendingRequests.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-[2rem] p-6 space-y-4 shadow-sm text-right">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-500/20">
                <Clock size={20} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800">طلبات سحب معلقة من الموكل ({pendingRequests.length})</h3>
                <p className="text-xs text-slate-500">هذه الطلبات مقدمة من بوابة الموكل ومحجوزة مؤقتاً في حسابه لحين اعتمادك أو رفضك</p>
              </div>
            </div>
            <Link to={`/store/${storeId}/merchant-settlement?tab=requests`} className="text-xs font-black text-amber-700 hover:underline">إدارة كافة الطلبات ←</Link>
          </div>

          <div className="space-y-3">
            {pendingRequests.map(req => {
              const isCustomQuote = req.type === 'custom_plan_quote';
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
              return (
                <div key={req.id} className="bg-white p-4 rounded-2xl border border-amber-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-black text-sm text-slate-900">
                        {isCustomQuote
                          ? 'طلب تسعير باقة مدير مخصصة (تسعير خاص لكل أوردر)'
                          : req.typeArabic || 'طلب سحب مستحقات'}
                      </span>
                      <span className="text-base font-black text-indigo-600 font-mono">
                        {isCustomQuote
                          ? `${targetOrders} أوردر (${isPrepaidQuote ? 'دفع مسبق' : 'خصم مع كل أوردر — ٠ ج.م مقدم'})`
                          : `${req.amount.toLocaleString()} ج.م`}
                      </span>
                      <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                        {new Date(req.createdAt || req.date).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                    {req.notes && <p className="text-xs text-slate-500 font-medium">📝 {req.notes}</p>}
                    {isCustomQuote && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-xs font-black text-amber-800">حدد سعر الأوردر (ج.م):</span>
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
                          className="w-24 px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50/50 text-xs font-black font-mono"
                        />
                        <span className="text-[11px] font-bold text-slate-500">ج.م / أوردر</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                    {isCustomQuote ? (
                      <>
                        <button
                          onClick={() => handleCustomQuoteAction(req, 'send_quote', quoteFeeVal)}
                          className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-sm transition-all cursor-pointer"
                        >
                          إرسال عرض السعر ({quoteFeeVal} ج/أوردر) 📤
                        </button>
                        <button
                          onClick={() => handleCustomQuoteAction(req, 'activate_now', quoteFeeVal)}
                          className="flex-1 sm:flex-none px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-xs shadow-sm transition-all cursor-pointer"
                        >
                          تفعيل فوري ({quoteFeeVal} ج/أوردر) ⚡
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setApprovalTransferRef('');
                          setApprovalReceiptImage('');
                          setSelectedReqForApproval(req);
                        }}
                        className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-sm transition-all cursor-pointer"
                      >
                        اعتماد وصرف ✅
                      </button>
                    )}
                    <button
                      onClick={() => handleRejectRequest(req)}
                      className="flex-1 sm:flex-none px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-black text-xs transition-all cursor-pointer"
                    >
                      رفض ❌
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-2 text-right">
          <div className="flex items-center gap-2 text-slate-500">
            <Calculator size={16} />
          <span className="text-[10px] font-black uppercase">إجمالي التحصيل من الطلبات</span>
          </div>
          <p className="text-xl font-black text-slate-900 font-mono">{(analytics?.totalCollected || 0).toLocaleString()} <span className="text-[10px]">ج.م</span></p>
          <p className="text-[10px] text-slate-400 font-medium">تحصيل الطلبات، وليس صافي المبلغ المسدّد للموكل</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-2 text-right">
          <div className="flex items-center gap-2 text-slate-500">
            <ArrowDownRight size={16} />
            <span className="text-[10px] font-black uppercase">إجمالي المسحوبات</span>
          </div>
          <p className="text-xl font-black text-rose-600 font-mono">
            {merchant.transactions?.filter(t => t.type === 'withdrawal').reduce((s, t) => s + Math.abs(t.amount), 0).toLocaleString() || 0} 
            <span className="text-[10px]"> ج.م</span>
          </p>
          <p className="text-[10px] text-slate-400 font-medium">المبالغ التي تم تحويلها للموكل فعلياً</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-2 text-right">
          <div className="flex items-center gap-2 text-slate-500">
            <PackageIcon size={16} />
            <span className="text-[10px] font-black uppercase">بضاعة قيد التحصيل</span>
          </div>
          <p className="text-xl font-black text-indigo-600 font-mono">
            {merchantOrders.filter(o => ['تم_الشحن', 'جاري_التوصيل', 'في_الطريق'].includes(o.status)).length} 
            <span className="text-[10px]"> شحنة</span>
          </p>
          <p className="text-[10px] text-slate-400 font-medium">أوردرات مشحونة لم يتم تحصيل قيمتها بعد</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-2 text-right">
          <div className="flex items-center gap-2 text-slate-500">
            <TrendingUp size={16} />
            <span className="text-[10px] font-black uppercase">نسبة نجاح التسليم</span>
          </div>
          <p className="text-xl font-black text-emerald-600 font-mono">{analytics?.deliverySuccessRate || 0}%</p>
          <p className="text-[10px] text-slate-400 font-medium">معدل استلام العملاء لبضاعة هذا الموكل</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white border border-slate-200 rounded-3xl p-2 flex items-center gap-1 overflow-x-auto no-scrollbar shadow-xs">
        {[
          { id: 'overview', label: 'المركز المالي والمحفظة', icon: WalletIcon },
          { id: 'transactions', label: 'كشف الحساب التفصيلي', icon: History },
          { id: 'settlements', label: 'سجل كشوف التسوية', icon: FileText },
          { id: 'inventory', label: 'المخزون وحركة الأصناف', icon: Layers },
          { id: 'requests', label: 'طلبات السحب والمصروفات', icon: Coins }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
              activeTab === tab.id 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <tab.icon size={16} />
            <span>{tab.label}</span>
            {tab.id === 'requests' && pendingRequests.length > 0 && (
              <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-full animate-pulse">{pendingRequests.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Balance Chart Card */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6 text-right">
              <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                    <Activity size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">منحنى سيولة محفظة الموكل</h3>
                    <p className="text-[11px] text-slate-500 font-medium">تتبع نمو رصيد الموكل الجاري المتاح للسحب عبر الزمن</p>
                  </div>
                </div>
              </div>

              <div className="h-80 w-full" dir="ltr">
                {chartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 font-bold text-xs">لا توجد حركات كافية في الحساب لرسم المنحنى حالياً.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} tickFormatter={(v) => v.toLocaleString()} />
                      <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 800, direction: 'rtl'}} />
                      <Area type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorBalance)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 text-right">
                  <h4 className="font-black text-sm text-slate-800 flex items-center gap-2">
                    <ShieldCheck className="text-emerald-600" size={18} />
                    إدارة صلاحيات دخول الموكل للبوابة
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    يمكن للموكل تسجيل الدخول لبوابته الخاصة <strong>/merchant-portal</strong> لمتابعة مبيعات بضاعته وطلب سحب الأرباح. تأكد من ربط بريده الإلكتروني ورمز الـ PIN الخاص به.
                  </p>
                  <div className="pt-2 flex flex-wrap gap-2">
                     <button 
                        onClick={() => navigate(`/store/${storeId}/merchant-settlement?tab=partners`)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all cursor-pointer"
                     >
                       تعديل بيانات الحساب ⚙️
                     </button>
                  </div>
               </div>

               <div className="bg-gradient-to-br from-slate-900 to-[#0d1b2a] p-6 rounded-3xl text-white shadow-xl space-y-4 relative overflow-hidden text-right">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                  <h4 className="font-black text-sm flex items-center gap-2 relative z-10">
                    <TrendingUp className="text-emerald-400" size={18} />
                    ملخص أداء المبيعات والمخزن
                  </h4>
                  <div className="grid grid-cols-2 gap-4 relative z-10">
                     <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400">إجمالي المبيعات المحصلة:</span>
                        <div className="text-lg font-black font-mono text-emerald-400">{(analytics?.totalCollected || 0).toLocaleString()} <span className="text-[10px]">ج.م</span></div>
                     </div>
                     <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400">عدد المنتجات المسجلة:</span>
                        <div className="text-lg font-black font-mono">{settings.products?.filter(p => p.merchantId === merchant.id).length || 0} <span className="text-[10px]">صنف</span></div>
                     </div>
                  </div>
                  <button 
                    onClick={() => setActiveTab('inventory')}
                    className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black transition-all cursor-pointer border border-white/10 relative z-10"
                  >
                    عرض حركة المخزن التفصيلية ←
                  </button>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden text-right">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
               <div>
                  <h3 className="text-sm font-black text-slate-900">سجل المعاملات المالية التاريخي</h3>
                  <p className="text-[11px] text-slate-500 font-medium">بيان تفصيلي بجميع التسويات والمسحوبات والتعديلات اليدوية على رصيد الموكل</p>
               </div>
               <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <button 
                    onClick={() => setShowDirectTxModal(true)}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                    title="تسجيل سحب نقدي مباشر أو خصم مصاريف أو إيداع"
                  >
                    <Coins size={14} className="text-amber-400" />
                    <span>+ حركة مالية جديدة</span>
                  </button>
                  <div className="relative w-full sm:w-auto">
                     <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                     <input 
                       type="text" 
                       placeholder="بحث في المعاملات..." 
                       value={searchTerm}
                       onChange={(e) => setSearchTerm(e.target.value)}
                       className="bg-white border border-slate-200 rounded-xl px-4 py-2 pr-9 text-xs outline-none focus:border-emerald-600 w-full sm:w-64" 
                     />
                  </div>
               </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                  <tr>
                    <th className="py-4 px-6 text-center">التاريخ</th>
                    <th className="py-4 px-3">نوع العملية</th>
                    <th className="py-4 px-3">البيان / الملاحظات</th>
                    <th className="py-4 px-3 text-center">المبلغ</th>
                    <th className="py-4 px-3 text-center">الرصيد بعدها</th>
                    <th className="py-4 px-6 text-center">بواسطة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold">
                  {(!merchant.transactions || merchant.transactions.length === 0) ? (
                    <tr>
                      <td colSpan={6} className="py-20 text-center text-slate-400 font-bold italic">لا توجد معاملات مسجلة حالياً في سجل محفظة الموكل</td>
                    </tr>
                  ) : (
                    merchant.transactions
                      .filter(t => !searchTerm || t.notes.toLowerCase().includes(searchTerm.toLowerCase()) || t.type.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-6 text-center font-mono font-bold text-slate-400">{new Date(tx.date).toLocaleDateString('ar-EG')}</td>
                        <td className="py-4 px-3">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                            tx.type === 'order_delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            tx.type === 'withdrawal' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                            tx.type === 'adjustment' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                            'bg-slate-50 text-slate-700 border-slate-100'
                          }`}>
                            {tx.type === 'order_delivered' ? 'تسوية مبيعات' : 
                             tx.type === 'withdrawal' ? 'سحب نقدي' : 
                             tx.type === 'adjustment' ? 'تعديل يدوي' : 
                             tx.type === 'lump_sum_deduction' ? 'خصم مجمع' : tx.type}
                          </span>
                        </td>
                        <td className="py-4 px-3 font-bold text-slate-700 max-w-xs">{tx.notes}</td>
                        <td className={`py-4 px-3 text-center font-black font-mono text-sm ${tx.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
                        </td>
                        <td className="py-4 px-3 text-center font-black font-mono text-slate-900 text-sm bg-slate-50/50">
                          {tx.balanceAfter?.toLocaleString() || '—'}
                        </td>
                        <td className="py-4 px-6 text-center text-[10px] font-black text-slate-400">{tx.performedBy || 'الإدارة'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'settlements' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4 text-right">
             <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="p-3 bg-slate-100 text-slate-600 rounded-2xl">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">أرشيف كشوف التسوية المعتمدة</h3>
                  <p className="text-xs text-slate-500">مراجعة كافة التسويات المالية السابقة التي تم اعتمادها لهذا الموكل</p>
                </div>
             </div>
             
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(settings.merchantSettlements || [])
                  .filter(s => s.status === 'paid' && (s.merchantId === merchant.id || s.merchantName === merchant.name))
                  .map(st => (
                  <div key={st.id} className="p-5 bg-slate-50 rounded-3xl border border-slate-200 hover:border-emerald-300 transition-all group">
                    <div className="flex justify-between items-start mb-3">
                      <div className="px-3 py-1 bg-white rounded-xl text-[10px] font-black border border-slate-200 font-mono text-slate-400 group-hover:text-emerald-600 group-hover:border-emerald-200 transition-colors">
                        #{st.settlementNumber}
                      </div>
                      <span className={`text-[10px] font-bold ${st.reversedAt ? 'text-rose-600' : 'text-slate-400'}`}>
                        {st.reversedAt ? 'معكوس · ' : ''}{new Date(st.date).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                    <div className="space-y-1 mb-4">
                      <p className="text-[11px] font-bold text-slate-500 uppercase">الصافي المحول للموكل:</p>
                      <p className="text-2xl font-black text-slate-900 font-mono">{(st.netPayoutToMerchant || 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span></p>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-200/50">
                      <span className="text-[10px] font-black text-slate-400">{st.ordersCount} أوردر مسوّى</span>
                      <button className="text-[10px] font-black text-emerald-600 hover:underline cursor-pointer">عرض التفاصيل ←</button>
                    </div>
                  </div>
                ))}
             </div>

             {(settings.merchantSettlements || []).filter(s => s.status === 'paid' && (s.merchantId === merchant.id || s.merchantName === merchant.name)).length === 0 && (
                <div className="py-20 text-center text-slate-400 font-bold text-xs italic">لا توجد كشوف تسوية تاريخية مسجلة لهذا الموكل حتى الآن.</div>
             )}
          </div>
        )}

        {activeTab === 'inventory' && analytics && (
          <div className="space-y-6 text-right">
             <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                      <PackageIcon size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">حركة بضاعة الموكل بالمخزن</h3>
                      <p className="text-xs text-slate-500">تحليل المبيعات، المرتجعات، والكميات المتبقية من أصناف الموكل حالياً</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black shadow-sm cursor-pointer hover:bg-emerald-700 transition-colors">جرد المخزون الآن 📝</button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">اسم المنتج / الصنف</th>
                        <th className="py-3 px-3 text-center">المباع (مسلم)</th>
                        <th className="py-3 px-3 text-center text-rose-600">المرتجع</th>
                        <th className="py-3 px-3 text-center font-black">المتبقي حالياً</th>
                        <th className="py-3 px-3 text-center">إجمالي المبيعات</th>
                        <th className="py-3 px-4 text-center">رأس مال البضاعة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold">
                      {analytics.productMovements.length === 0 ? (
                        <tr><td colSpan={6} className="py-12 text-center text-slate-400 italic">لا توجد حركة بضاعة مسجلة</td></tr>
                      ) : (
                        analytics.productMovements.map(pm => (
                          <tr key={pm.productId} className="hover:bg-slate-50">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                  <PackageIcon size={14} />
                                </div>
                                <span className="font-bold text-slate-800">{pm.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-emerald-600 bg-emerald-50/20">{pm.quantityDelivered} ق</td>
                            <td className="py-3 px-3 text-center font-bold text-rose-600 bg-rose-50/20">{pm.quantityReturned} ق</td>
                            <td className="py-3 px-3 text-center font-black text-indigo-700 bg-indigo-50/30">
                              {(settings.products?.find(p => p.id === pm.productId)?.stockQuantity || 0)} ق
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">{pm.totalDeliveredSales.toLocaleString()} ج.م</td>
                            <td className="py-3 px-4 text-center font-mono font-black text-emerald-600">{pm.totalDeliveredCost.toLocaleString()} ج.م</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                  <Coins size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">سجل طلبات السحب والمصروفات الواردة</h3>
                  <p className="text-xs text-slate-500">مراجعة كافة الطلبات المالية المقدمة من الموكل وحالات اعتمادها</p>
                </div>
              </div>
              <button 
                onClick={loadRequests}
                disabled={isLoadingRequests}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer border border-slate-200"
              >
                <RefreshCw size={16} className={isLoadingRequests ? 'animate-spin text-emerald-600' : ''} />
              </button>
            </div>

            <div className="space-y-3">
               {merchantRequests.length === 0 ? (
                  <div className="py-20 text-center text-slate-400 font-black text-xs italic">لا توجد طلبات واردة من هذا الموكل حتى الآن.</div>
               ) : (
                 merchantRequests.map(req => {
                   const isPending = req.status === 'pending';
                   const isApproved = req.status === 'approved';
                   const isRejected = req.status === 'rejected';
                   const isCustomQuote = req.type === 'custom_plan_quote';
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

                   return (
                     <div key={req.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-4">
                           <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                             isPending ? 'bg-amber-100 text-amber-600' :
                             isApproved ? 'bg-emerald-100 text-emerald-600' :
                             'bg-rose-100 text-rose-600'
                           }`}>
                             <Coins size={20} />
                           </div>
                           <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-sm text-slate-900">
                                  {isCustomQuote
                                    ? 'طلب تسعير باقة مدير مخصصة (تسعير خاص لكل أوردر)'
                                    : req.typeArabic || 'طلب سحب مستحقات'}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">({new Date(req.createdAt || req.date).toLocaleDateString('ar-EG')})</span>
                              </div>
                              <p className="text-[11px] text-slate-500 max-w-md">{req.notes || 'لا يوجد ملاحظات إضافية'}</p>
                              {isCustomQuote && isPending && (
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  <span className="text-[11px] font-black text-amber-800">حدد سعر الأوردر (ج.م):</span>
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
                                    className="w-24 px-2 py-1 rounded-lg border border-amber-300 bg-white text-xs font-black font-mono"
                                  />
                                  <span className="text-[10px] font-bold text-slate-500">ج.م / أوردر</span>
                                </div>
                              )}
                              {(req.transferReference || req.receiptImage) && (
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  {req.transferReference && (
                                    <span className="text-[10px] font-mono font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200">
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
                           </div>
                        </div>
                        
                        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                           <div className="text-left space-y-0.5">
                              <p className="text-sm font-black text-slate-900 font-mono">
                                {isCustomQuote
                                  ? `${targetOrders} أوردر (${isPrepaidQuote ? 'دفع مسبق' : 'خصم لكل أوردر'})`
                                  : `${req.amount.toLocaleString()} ج.م`}
                              </p>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                                isPending ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                isApproved ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                'bg-rose-100 text-rose-700 border-rose-200'
                              }`}>
                                {isPending ? 'قيد المراجعة ⏳' : isApproved ? 'تم الاعتماد ✅' : 'تم الرفض ❌'}
                              </span>
                           </div>
                           
                           {isPending && (
                             <div className="flex items-center gap-2 flex-wrap">
                               {isCustomQuote ? (
                                 <>
                                   <button
                                     onClick={() => handleCustomQuoteAction(req, 'send_quote', quoteFeeVal)}
                                     className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black transition-all cursor-pointer shadow-sm"
                                   >
                                     إرسال عرض السعر ({quoteFeeVal} ج/أوردر) 📤
                                   </button>
                                   <button
                                     onClick={() => handleCustomQuoteAction(req, 'activate_now', quoteFeeVal)}
                                     className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10px] font-black transition-all cursor-pointer shadow-sm"
                                   >
                                     تفعيل فوري ({quoteFeeVal} ج/أوردر) ⚡
                                   </button>
                                 </>
                               ) : (
                                 <button 
                                    onClick={() => {
                                      setApprovalTransferRef('');
                                      setApprovalReceiptImage('');
                                      setSelectedReqForApproval(req);
                                    }}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black transition-all cursor-pointer shadow-sm"
                                 >
                                   اعتماد وصرف ✅
                                 </button>
                               )}
                               <button 
                                  onClick={() => handleRejectRequest(req)}
                                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[10px] font-black transition-all cursor-pointer"
                               >
                                 رفض ❌
                               </button>
                             </div>
                           )}
                        </div>
                     </div>
                   );
                 })
               )}
            </div>
          </div>
        )}
      </div>
      {/* Modal 1: Direct Financial Transaction (Cash Advance / Direct Payout / Expense / Deposit) */}
      {showDirectTxModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-5 text-right font-sans">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2.5 bg-slate-900 text-white rounded-2xl">
                  <Coins size={20} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">تسجيل حركة مالية بحساب الموكل</h3>
                  <p className="text-[11px] text-slate-500 font-medium">سحب نقدي مباشر أو خصم مصاريف أو إيداع يظهر في بوابته وتخصم من حسابه</p>
                </div>
              </div>
              <button onClick={() => setShowDirectTxModal(false)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs">
              <span className="text-slate-600 font-bold">رصيد محفظة الموكل الحالي:</span>
              <span className="font-mono font-black text-emerald-700 text-sm">{(merchant.balance || 0).toLocaleString()} ج.م</span>
            </div>

            <form onSubmit={handleExecuteDirectTx} className="space-y-4 text-xs font-bold">
              {/* Transaction Type */}
              <div>
                <label className="block text-slate-700 mb-1.5">نوع المعاملة المالية:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDirectTxType('withdrawal')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                      directTxType === 'withdrawal'
                        ? 'bg-rose-50 text-rose-800 border-rose-300 ring-2 ring-rose-400/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    سحب نقدي مباشر 💸
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirectTxType('expense')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                      directTxType === 'expense'
                        ? 'bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-400/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    خصم مصروفات 📉
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirectTxType('deposit')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                      directTxType === 'deposit'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-400/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    إضافة رصيد / إيداع 📈
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-slate-700 mb-1">المبلغ (ج.م):</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={directTxAmount}
                  onChange={e => setDirectTxAmount(e.target.value)}
                  placeholder="مثال: 1500"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono font-black text-sm"
                />
              </div>

              {/* Central Treasury Linkage */}
              {(treasury?.accounts || []).length > 0 && (
                <div>
                  <label className="block text-slate-700 mb-1">حساب الخزينة المركزية للصرف / الإيداع:</label>
                  <select
                    value={directTxTreasuryId}
                    onChange={e => setDirectTxTreasuryId(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-xs"
                  >
                    <option value="">تسوية دفترية فقط (بدون التأثير على أرصدة الخزينة المركزية)</option>
                    {(treasury?.accounts || []).map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} — الرصيد المتاح: {acc.balance.toLocaleString()} ج.م
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1 font-medium">
                    إذا اخترت حساب خزينة، سيتم خصم أو إضافة المبلغ إلى الخزينة المركزية تلقائياً وتوثيق الحركة في سجل الخزينة.
                  </p>
                </div>
              )}

              {/* Notes / Description */}
              <div>
                <label className="block text-slate-700 mb-1">البيان والسبب (يظهر في كشف حساب الموكل ببوابته):</label>
                <input
                  type="text"
                  required
                  value={directTxNotes}
                  onChange={e => setDirectTxNotes(e.target.value)}
                  placeholder={
                    directTxType === 'withdrawal'
                      ? 'مثال: سحب نقدي باليد دفعة تحت الحساب أثناء الزيارة'
                      : directTxType === 'expense'
                      ? 'مثال: خصم تكلفة إعلانات فيسبوك ممولة خاصة بالبضاعة'
                      : 'مثال: تعويض بضاعة تالفة أو بونص مبيعات'
                  }
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs"
                />
              </div>

              {/* Reference */}
              <div>
                <label className="block text-slate-700 mb-1">رقم الإيصال / مرجع المعاملة (اختياري):</label>
                <input
                  type="text"
                  value={directTxRef}
                  onChange={e => setDirectTxRef(e.target.value)}
                  placeholder="مثال: REC-98234"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDirectTxModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black cursor-pointer shadow-md"
                >
                  حفظ وتسجيل الحركة فـ المحفظة ✅
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Treasury-linked Request Approval Dialog */}
      {selectedReqForApproval && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 text-right font-sans max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-900">اعتماد وصرف طلب سحب المستحقات</h3>
              <button onClick={() => { setSelectedReqForApproval(null); setApprovalTransferRef(''); setApprovalReceiptImage(''); }} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">الموكل:</span>
                <span className="font-black text-slate-900">{selectedReqForApproval.partnerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">مبلغ السحب المطلوب:</span>
                <span className="font-mono font-black text-indigo-700 text-sm">{selectedReqForApproval.amount.toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">رصيد محفظة الموكل:</span>
                <span className="font-mono font-black text-emerald-700">{(merchant.balance || 0).toLocaleString()} ج.م</span>
              </div>
              {selectedReqForApproval.notes && (
                <div className="pt-1 border-t border-slate-200 text-slate-600">
                  <span className="font-bold">الملاحظات وطريقة الاستلام: </span>
                  <span>{selectedReqForApproval.notes}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-slate-700 text-xs font-bold mb-1.5">صرف المبلغ من حساب الخزينة المركزية:</label>
              <select
                value={approvalTreasuryAccountId}
                onChange={e => setApprovalTreasuryAccountId(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-xs"
              >
                <option value="">تسوية دفترية فقط (خصم من محفظة الموكل دون الخزينة)</option>
                {(treasury?.accounts || []).map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} — الرصيد: {acc.balance.toLocaleString()} ج.م
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 text-xs font-bold mb-1.5">رقم المرجع البنكي / عملية التحويل (اختياري):</label>
              <input
                type="text"
                value={approvalTransferRef}
                onChange={e => setApprovalTransferRef(e.target.value)}
                placeholder="مثال: INSTA-982341 أو رقم عملية المحفظة..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono font-bold text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-700 text-xs font-bold mb-1.5">إرفاق صورة إيصال التحويل البنكي / المحفظة (تظهر للموكل في بوابته):</label>
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-3 text-center bg-slate-50/50">
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

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => { setSelectedReqForApproval(null); setApprovalTransferRef(''); setApprovalReceiptImage(''); }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => handleApproveRequest(selectedReqForApproval, approvalTreasuryAccountId)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black cursor-pointer shadow-md"
              >
                تأكيد الاعتماد والصرف ✅
              </button>
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
          <div className="relative max-w-2xl w-full bg-white rounded-3xl p-4 shadow-2xl border border-slate-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <h4 className="font-black text-sm text-slate-900">صورة إيصال التحويل البنكي / المحفظة 🧾</h4>
              <button onClick={() => setPreviewReceiptImage(null)} className="p-1.5 rounded-xl bg-slate-100 text-slate-600 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <img src={previewReceiptImage} alt="إيصال التحويل" className="max-h-[75vh] w-auto mx-auto rounded-2xl object-contain" />
          </div>
        </div>
      )}

      {showSettlementModal && setOrders && (
        <BulkOrderSettlementModal
          isOpen={showSettlementModal}
          onClose={() => setShowSettlementModal(false)}
          orderIds={unsettledOrders.map(o => o.id)}
          orders={orders}
          settings={settings}
          updateSettings={updateSettings as any}
          setOrders={setOrders}
          treasury={treasury}
          setTreasury={setTreasury as any}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

export default MerchantProfilePage;
