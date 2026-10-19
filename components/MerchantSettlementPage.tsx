import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Settings, Order, MerchantSettlement, MerchantSettlementOrderSnapshot, Treasury, CustomerProfile, MerchantTransaction } from '../types';
import { 
  Building2, DollarSign, Calculator, FileText, CheckCircle2, 
  Printer, Download, Plus, Search, Filter, Calendar, User, 
  ArrowUpRight, ArrowDownLeft, Wallet, ShieldAlert, Sparkles, X, Paperclip, ChevronDown, Check, Speaker,
  Landmark, TrendingUp, TrendingDown, RefreshCw, MessageSquare, RotateCcw, Eye, SlidersHorizontal,
  Layers, Percent, PackageCheck, AlertTriangle, Trash2, ExternalLink, FileSpreadsheet, Info, Globe, Mail, Loader2,
  Coins, Clock, XCircle
} from 'lucide-react';
import * as db from '../services/databaseService';
import { printHTMLDirectly } from '../utils/printHelper';
import { InvoiceAttachmentUploader } from './InvoiceAttachmentUploader';
import { MerchantTransparencyTab } from './MerchantTransparencyTab';
import MerchantPortal from './MerchantPortal';
import * as XLSX from 'xlsx';
import { calculateCodFee, calculateOrderShippingAndFees, getStandardShippingFee, getCompanySpecificFees, calculateInsuranceFee, calculateBostaVat } from '../utils/financials';
import { inAppAlert, inAppConfirm, inAppToast } from '../utils/inAppAlert';

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

const normalizeName = (name: string) => (name || '').trim().toLowerCase().replace(/\s+/g, ' ');

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

  // 3. Inspection Fee
  const inspectionCost = useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0);
  const rawInspection = (order.inspectionFee !== undefined && order.inspectionFee !== null && Number(order.inspectionFee) > 0)
    ? Number(order.inspectionFee)
    : (order.includeInspectionFee === false ? 0 : inspectionCost);
  const inspectionFee = ov?.inspectionFee !== undefined ? ov.inspectionFee : rawInspection;

  // 4. VAT Fee (14% VAT on shipping + inspection + insurance)
  const rawVat = (order.vatValue !== undefined && order.vatValue !== null && Number(order.vatValue) > 0 && !order.vatOnStandardShipping)
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
}

interface MerchantSettlementPageProps {
  orders: Order[];
  settings: Settings;
  updateSettings: React.Dispatch<React.SetStateAction<Settings>>;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  treasury?: Treasury;
  setTreasury?: React.Dispatch<React.SetStateAction<Treasury | undefined>>;
  customers?: CustomerProfile[];
  currentUser?: any;
}

export const MerchantSettlementPage: React.FC<MerchantSettlementPageProps> = ({
  orders,
  settings,
  updateSettings,
  setOrders,
  treasury,
  setTreasury,
  customers = [],
  currentUser
}) => {
  const [activeTab, setActiveTab] = useState<'settlements' | 'create' | 'requests' | 'partners' | 'transparency' | 'portal'>('settlements');
  const [transparencyMerchantId, setTransparencyMerchantId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>('');
  
  // Merchant Incoming Payout Requests
  const [rawRequests, setRawRequests] = useState<db.PartnerPortalRequest[]>([]);
  const [requestsFilterStatus, setRequestsFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const activeStoreId = useMemo(() => {
    try {
      return localStorage.getItem('activeStoreId') || 'default';
    } catch {
      return 'default';
    }
  }, []);

  const loadMerchantRequests = useCallback(async () => {
    try {
      const reqs = await db.getPartnerRequests(activeStoreId);
      setRawRequests(reqs);
    } catch (_) {}
  }, [activeStoreId]);

  useEffect(() => {
    loadMerchantRequests();
  }, [loadMerchantRequests]);

  const merchantRequests = useMemo(() => {
    const fromSettings = (settings as any).partnerRequests || [];
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

  const handleApproveMerchantRequest = async (req: db.PartnerPortalRequest) => {
    try {
      await db.updatePartnerRequestStatus(req.id, activeStoreId, 'approved');
      setRawRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'approved' } : r));

      // Update Merchant Balance and record Withdrawal Transaction
      updateSettings(currentSettings => {
        const updatedSuppliers = (currentSettings.suppliers || []).map(s => {
          if (s.id === req.partnerId || normalizeName(s.name) === normalizeName(req.partnerName)) {
            const currentBalance = s.balance || 0;
            const newTx: MerchantTransaction = {
              id: `mtx-w-${Date.now()}`,
              merchantId: s.id,
              merchantName: s.name,
              date: new Date().toISOString(),
              type: 'withdrawal',
              amount: -req.amount, // Negative for withdrawal
              balanceAfter: currentBalance - req.amount,
              notes: `سحب مستحقات (طلب #${req.id.slice(-6)}) - ${req.notes || ''}`,
              referenceId: req.id,
              performedBy: currentUser?.fullName || 'الإدارة'
            };
            return {
              ...s,
              balance: currentBalance - req.amount,
              transactions: [newTx, ...(s.transactions || [])]
            };
          }
          return s;
        });
        return { ...currentSettings, suppliers: updatedSuppliers };
      });

      inAppToast(`تم اعتماد طلب السحب للموكل ${req.partnerName} بمبلغ ${req.amount.toLocaleString()} ج.م بنجاح ✅`, 'success');
    } catch (err: any) {
      inAppToast('حدث خطأ أثناء اعتماد الطلب: ' + (err.message || ''), 'error');
    }
  };

  const handleRejectMerchantRequest = async (reqId: string) => {
    try {
      await db.updatePartnerRequestStatus(reqId, activeStoreId, 'rejected');
      setRawRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'rejected' } : r));
      inAppToast('تم رفض طلب السحب للموكل', 'info');
    } catch (err: any) {
      inAppToast('حدث خطأ أثناء رفض الطلب', 'error');
    }
  };
  
  // History Filters
  const [historyMerchantFilter, setHistoryMerchantFilter] = useState<string>('');
  const [historyDateFilter, setHistoryDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'paid' | 'draft'>('all');

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

  // Extract Merchants List strictly from:
  // 1. Registered Suppliers / Partners (settings.suppliers & settings.partners)
  // 2. Customers explicitly tagged as 'merchant' / 'موكل' / 'صاحب بضاعة'
  // 3. Unique merchantId / merchantName assigned on orders (excluding 'pending')
  // 4. Historical settlements (settings.merchantSettlements)
  const merchantsList = useMemo(() => {
    const list: Array<{ id: string; name: string; phone?: string; email?: string; sourceLabel?: string }> = [];
    const seen = new Set<string>();

    // 1. From Suppliers
    (settings.suppliers || []).forEach(s => {
      if (s.id && s.name && !seen.has(s.id)) {
        seen.add(s.id);
        seen.add(s.name.trim());
        list.push({ 
          id: s.id, 
          name: s.name.trim(), 
          phone: s.phone, 

          sourceLabel: 'مورد / صاحب بضاعة' 
        });
      }
    });

    // Also merge email/phone from settings.partners if person exists in suppliers list
    (settings.partners || []).forEach(p => {
      const existing = list.find(item => item.id === p.id || item.name === p.name);
      if (existing) {
        if (!existing.email && p.email) existing.email = p.email;
        if (!existing.phone && p.phone) existing.phone = p.phone;
      }
    });

    // 2. From Customers ONLY if explicitly marked as a merchant / supplier (never regular store buyers or profit-share partners!)
    customers.forEach(c => {
      const isTaggedMerchant =
        c.customerSegment === 'merchant' ||
        (Array.isArray(c.tags) && c.tags.some(t => ['موكل', 'صاحب بضاعة', 'تاجر', 'مورد', 'merchant', 'supplier'].includes(String(t).trim().toLowerCase())));
      if (isTaggedMerchant && c.phone && c.name && !seen.has(c.phone) && !seen.has(c.name.trim())) {
        seen.add(c.phone);
        seen.add(c.name.trim());
        list.push({ id: c.phone, name: c.name.trim(), phone: c.phone, email: c.email, sourceLabel: 'موكل مسجل' });
      }
    });

    // 3. Unique merchantId / merchantName from agency orders
    orders.forEach(o => {
      const mName = (o.merchantName || '').trim();
      const mId = (o.merchantId || '').trim();
      if (mName && mId !== 'pending' && !seen.has(mName) && (!mId || !seen.has(mId))) {
        seen.add(mName);
        if (mId) seen.add(mId);
        list.push({ id: mId || mName, name: mName, phone: o.merchantBrandPhone, sourceLabel: 'موكل أوردرات' });
      }
    });

    // 4. Historical merchant settlements
    (settings.merchantSettlements || []).forEach(st => {
      const mName = (st.merchantName || '').trim();
      const mId = (st.merchantId || '').trim();
      if (mName && !seen.has(mName) && (!mId || !seen.has(mId))) {
        seen.add(mName);
        if (mId) seen.add(mId);
        list.push({ id: mId || mName, name: mName, sourceLabel: 'كشوف سابقة' });
      }
    });

    return list;
  }, [settings.suppliers, settings.partners, settings.merchantSettlements, customers, orders]);

  // Helper to check if an order belongs to a specific merchant/partner (never matching buyer customerPhone/customerName)
  const doesOrderBelongToMerchant = (o: Order, merchantIdOrName: string, merchantObj?: { id: string; name: string }) => {
    if (!o.merchantId && !o.merchantName) return false;
    if (o.merchantId === 'pending') return false;
    if (o.merchantId === merchantIdOrName || o.merchantName === merchantIdOrName) return true;
    if (merchantObj && (o.merchantId === merchantObj.id || o.merchantName === merchantObj.name || o.merchantName === merchantObj.id)) {
      return true;
    }
    return false;
  };

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
      address: '',
      notes: 'موكل / صاحب بضاعة (تمت إضافته من شاشة التسويات)',
      defaultMarketingFeePerOrder: newPartnerDefaultMarketing > 0 ? newPartnerDefaultMarketing : undefined
    };

    const newPartnerInPartners = {
      id: newId,
      name: newPartnerName.trim(),
      phone: newPartnerPhone.trim(),
      email: cleanEmail,
      balance: 0,
      profitRatio: 50,
      passcode: '0000',
      role: 'موكل صاحب بضاعة'
    };

    updateSettings(prev => ({
      ...prev,
      suppliers: [newPartner, ...(prev.suppliers || [])],
      partners: [newPartnerInPartners, ...(prev.partners || []).filter(p => p.id !== newId)]
    }));

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
        const updatedSuppliers = (prev.suppliers || []).map(s => {
          if (s.id === editingPartnerForEmail.id || s.name === editingPartnerForEmail.name) {
            return { ...s, email: cleanEmail };
          }
          return s;
        });

        // Also update or add to partners list
        const existingPartner = (prev.partners || []).find(p => p.id === editingPartnerForEmail.id || p.name === editingPartnerForEmail.name);
        let updatedPartners = [...(prev.partners || [])];
        if (existingPartner) {
          updatedPartners = updatedPartners.map(p => 
            p.id === existingPartner.id ? { ...p, email: cleanEmail } : p
          );
        } else {
          updatedPartners.push({
            id: editingPartnerForEmail.id,
            name: editingPartnerForEmail.name,
            phone: '',
            email: cleanEmail,
            balance: 0,
            profitRatio: 50,
            passcode: '0000',
            role: 'موكل صاحب بضاعة'
          });
        }

        return {
          ...prev,
          suppliers: updatedSuppliers,
          partners: updatedPartners
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
      const mOrders = orders.filter(o => doesOrderBelongToMerchant(o, m.id, m));
      const unsettledEligible = mOrders.filter(o => o.settlementStatus !== 'settled' && SETTLEMENT_ELIGIBLE_STATUSES.includes(o.status));
      const settledOrders = mOrders.filter(o => o.settlementStatus === 'settled');
      const deliveredCount = mOrders.filter(o => DELIVERED_STATUSES.includes(o.status)).length;
      const returnCount = mOrders.filter(o => RETURN_STATUSES.includes(o.status)).length;
      const pendingCollection = unsettledEligible.reduce((sum, o) => sum + (DELIVERED_STATUSES.includes(o.status) ? (o.totalPrice || 0) : 0), 0);
      const pendingGoodsCost = unsettledEligible.reduce((sum, o) => {
        const gc = o.merchantItemCost || (o.items || []).reduce((s, i) => s + ((i.cost || 0) * (i.quantity || 1)), 0);
        return sum + (DELIVERED_STATUSES.includes(o.status) ? gc : 0);
      }, 0);

      const mSettlements = (settings.merchantSettlements || []).filter(st => st.merchantId === m.id || st.merchantName === m.name);
      const totalPaidOut = mSettlements.reduce((sum, st) => sum + (st.netPayoutToMerchant || 0), 0);
      const totalAgencyEarned = mSettlements.reduce((sum, st) => sum + (st.totalOperatorEarnings ?? st.totalServiceFees ?? 0), 0);

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
        totalAgencyEarned
      };
    }).sort((a, b) => b.unsettledCount - a.unsettledCount || b.totalOrdersCount - a.totalOrdersCount);
  }, [merchantsList, orders, settings.merchantSettlements]);

  // Global Executive KPIs
  const executiveMetrics = useMemo(() => {
    const allSettlements = settings.merchantSettlements || [];
    const totalNetPaid = allSettlements
      .filter(s => s.status !== 'draft')
      .reduce((sum, s) => sum + (s.netPayoutToMerchant || 0), 0);
    const totalOperatorRevenue = allSettlements
      .reduce((sum, s) => sum + (s.totalOperatorEarnings ?? s.totalServiceFees ?? 0), 0);
    const totalRecoveredDeductions = allSettlements
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

  // Unsettled Orders for the Selected Merchant
  const eligibleOrders = useMemo(() => {
    if (!selectedMerchantId) return [];
    const selectedPartner = merchantsList.find(m => m.id === selectedMerchantId);

    return orders.filter(o => {
      const isMatch = doesOrderBelongToMerchant(o, selectedMerchantId, selectedPartner);
      const isUnsettled = o.settlementStatus !== 'settled';
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
        return numMatch || custMatch || phoneMatch;
      }
      return true;
    });
  }, [eligibleOrders, orderTableFilter, orderTableSearch]);

  // Auto-select all eligible orders when merchant changes
  const handleSelectMerchant = (mId: string) => {
    setSelectedMerchantId(mId);
    const selectedPartner = merchantsList.find(m => m.id === mId);
    const mOrders = orders.filter(o => {
      const isMatch = doesOrderBelongToMerchant(o, mId, selectedPartner);
      return isMatch && o.settlementStatus !== 'settled' && SETTLEMENT_ELIGIBLE_STATUSES.includes(o.status);
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
  const computeOrderFinancials = (o: Order) => {
    const ov = orderOverrides[o.id] || {};
    const isDelivered = DELIVERED_STATUSES.includes(o.status);
    const isReturn = RETURN_STATUSES.includes(o.status);

    // Accounting Mode resolution: Per-Order Override -> Batch Override -> Order Default
    const effectiveMode: 'fixed_fee' | 'profit_share' | 'wholesale' = ov.mode
      ? ov.mode
      : batchAccountingMode !== 'order_default'
      ? batchAccountingMode
      : o.merchantSettlementMode === 'profit_share'
      ? 'profit_share'
      : o.merchantSettlementMode === 'wholesale'
      ? 'wholesale'
      : 'fixed_fee';

    const effectiveSharePercent = ov.sharePercent !== undefined
      ? ov.sharePercent
      : batchAccountingMode === 'profit_share'
      ? batchProfitSharePercent
      : (o.merchantProfitSharePercent || 50);

    // 1. Goods Cost
    const defaultGoodsCost = o.merchantItemCost || (o.items || []).reduce((s, i) => s + ((i.cost || 0) * (i.quantity || 1)), 0);
    const goodsCost = ov.goodsCost !== undefined ? ov.goodsCost : defaultGoodsCost;

    // 2. Shipping & Carrier Fees Breakdown
    const shippingBreakdown = calculateMerchantShippingBreakdown(o, settings, ov);
    const shippingAndFees = shippingBreakdown.total;

    // 3. Collection Fees (COD fees)
    const codFee = isDelivered ? shippingBreakdown.codFee : 0;

    // 4. Marketing Cost
    const defaultMarketing = o.marketingFeePerOrder !== undefined && o.marketingFeePerOrder > 0 ? o.marketingFeePerOrder : batchMarketingFee;
    const marketingCost = ov.marketingFee !== undefined ? ov.marketingFee : defaultMarketing;

    // 5. Service Fee
    const defaultServiceFee = o.serviceFeePerOrder !== undefined ? o.serviceFeePerOrder : flatServiceFee;
    const serviceFee = ((isDelivered || chargeServiceFeeOnReturns) && effectiveMode !== 'profit_share')
      ? (ov.serviceFee !== undefined ? ov.serviceFee : defaultServiceFee)
      : 0;

    // 6. Return Fee
    // Use the component-level state if enabled, otherwise 0.
    // If there's an override on the order, use that.
    const returnFee = isReturn && deductReturnsFee 
      ? (ov.returnFee !== undefined ? ov.returnFee : returnShippingFeeAmount) 
      : 0;

    // 7. Collected Cash Revenue from Customer
    const orderRevenue = isDelivered 
      ? (o.totalAmountOverride !== undefined && o.totalAmountOverride !== null && Number(o.totalAmountOverride) > 0
          ? Number(o.totalAmountOverride)
          : (Number(o.totalPrice) || 0))
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
  const buildDraftSettlement = (status: 'draft' | 'paid' = 'paid'): MerchantSettlement => {
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
      paidFromTreasuryAccountId: selectedTreasuryAccountId || undefined,
      paidFromTreasuryAccountName: treasuryAccount?.name || channelLabels[payoutChannel] || undefined,
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
  const handleExecuteSettlement = async (saveAsStatus: 'paid' | 'draft' = 'paid') => {
    if (!selectedMerchantId) {
      await inAppAlert('يرجى اختيار العميل / صاحب البضاعة أولاً من القائمة.', { title: 'بيانات ناقصة', type: 'warning' });
      return;
    }
    if (selectedOrderIds.length === 0 || settlementCalculation.ordersCount === 0) {
      await inAppAlert('يرجى تحديد أوردر واحد على الأقل من جدول الأوردرات الجاهزة للتسوية.', { title: 'لا توجد أوردرات محددة', type: 'warning' });
      return;
    }

    if (saveAsStatus === 'paid' && settlementCalculation.netPayoutToMerchant < 0) {
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

    const newSettlement = buildDraftSettlement(saveAsStatus);

    // Deduct Net Payout from Treasury Account if selected and status is paid and netPayout > 0
    if (saveAsStatus === 'paid' && selectedTreasuryAccountId && settlementCalculation.netPayoutToMerchant > 0 && setTreasury && treasury) {
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

    // Update Orders Status to 'settled' (and persist any custom overrides made on the orders)
    setOrders(currentOrders => currentOrders.map(o => {
      if (!selectedOrderIds.includes(o.id)) return o;
      const ov = orderOverrides[o.id];
      return {
        ...o,
        settlementStatus: 'settled' as const,
        settlementId: newSettlement.id,
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

    // Update Settlement, Merchant Balance and Ledger
    updateSettings(currentSettings => {
      const updatedSuppliers = (currentSettings.suppliers || []).map(s => {
        if (s.id === selectedMerchantId) {
          const currentBalance = s.balance || 0;
          const newTx: MerchantTransaction = {
            id: `mtx-${Date.now()}`,
            merchantId: s.id,
            merchantName: s.name,
            date: new Date().toISOString(),
            type: 'order_delivered',
            amount: settlementCalculation.netPayoutToMerchant,
            balanceAfter: currentBalance + settlementCalculation.netPayoutToMerchant,
            notes: `كشف تسوية أوردرات رقم ${newSettlement.settlementNumber} - (${newSettlement.ordersCount} أوردر)`,
            referenceId: newSettlement.id,
            performedBy: currentUser?.fullName || 'الإدارة'
          };
          return {
            ...s,
            balance: currentBalance + settlementCalculation.netPayoutToMerchant,
            transactions: [newTx, ...(s.transactions || [])]
          };
        }
        return s;
      });

      return {
        ...currentSettings,
        suppliers: updatedSuppliers,
        merchantSettlements: [newSettlement, ...(currentSettings.merchantSettlements || [])]
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
  const handleReverseSettlement = async (settlement: MerchantSettlement) => {
    const confirmed = await inAppConfirm(
      `هل أنت متأكد من إلغاء كشف التسوية (${settlement.settlementNumber}) للموكل "${settlement.merchantName}"؟ سيتم إعادة فتح (${settlement.ordersCount}) أوردر لتصبح قابلة للتسوية مرة أخرى${settlement.paidFromTreasuryAccountId ? ' واسترداد المبلغ المخصوم إلى الخزينة تلقائياً' : ''}.`,
      {
        title: 'إلغاء واسترداد كشف التسوية',
        confirmText: 'تأكيد الإلغاء والاسترداد',
        cancelText: 'تراجع',
        type: 'danger'
      }
    );
    if (!confirmed) return;

    // 1. Re-open settled orders
    const snapshotIds = new Set((settlement.orderSnapshots || []).map(s => s.orderId));
    setOrders(currentOrders => currentOrders.map(o => {
      if (o.settlementId === settlement.id || snapshotIds.has(o.id)) {
        return {
          ...o,
          settlementStatus: 'unsettled' as const,
          settlementId: undefined
        };
      }
      return o;
    }));

    // 2. Restore Treasury Balance if deducted
    if (settlement.status === 'paid' && settlement.paidFromTreasuryAccountId && settlement.netPayoutToMerchant > 0 && setTreasury && treasury) {
      setTreasury(currentTreasury => {
        if (!currentTreasury) return currentTreasury;
        return {
          ...currentTreasury,
          accounts: currentTreasury.accounts.map(acc =>
            acc.id === settlement.paidFromTreasuryAccountId
              ? { ...acc, balance: acc.balance + settlement.netPayoutToMerchant }
              : acc
          ),
          transactions: (currentTreasury.transactions || []).filter(tx => tx.reference !== settlement.settlementNumber)
        };
      });
    }

    // 3. Remove settlement from settings
    updateSettings(currentSettings => ({
      ...currentSettings,
      merchantSettlements: (currentSettings.merchantSettlements || []).filter(s => s.id !== settlement.id)
    }));

    if (viewingSettlement?.id === settlement.id) {
      setViewingSettlement(null);
    }

    inAppToast(`تم إلغاء الكشف ${settlement.settlementNumber} وإعادة فتح الأوردرات بنجاح.`, 'info');
  };

  // Share via WhatsApp
  const handleShareWhatsApp = (settlement: MerchantSettlement) => {
    const partner = merchantsList.find(m => m.id === settlement.merchantId || m.name === settlement.merchantName);
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
          <div>اسم الموكل / الشريك: <span style="color:#008060;">${settlement.merchantName}</span></div>
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
      const matchMerchant = !historyMerchantFilter || st.merchantId === historyMerchantFilter || st.merchantName === historyMerchantFilter;
      const matchStatus = historyStatusFilter === 'all' || st.status === historyStatusFilter;

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
      'الموكل / الشريك': st.merchantName,
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
      'الحالة': st.status === 'draft' ? 'مسودة' : 'مدفوع',
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
      {/* 1. BRAND IDENTITY ARCHITECTURAL HERO BANNER              */}
      {/* ======================================================== */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-[#0d1b2a] to-emerald-950 text-white p-6 sm:p-8 rounded-[2.25rem] shadow-2xl border border-slate-800/90">
        {/* Subtle Brand Ambient Glow */}
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 right-1/3 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-emerald-300/90">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>منظومة الإدارة المالية الشاملة</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="text-slate-300">تسوية حسابات أصحاب البضائع والموكلين</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="text-emerald-400 font-mono">{merchantsList.length} موكل مسجل</span>
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
                  محاسبة دقيقة وشفافة للموكلين بنظامي العمولة الثابتة ومشاركة الأرباح، مع خصم آلي لفروق الشحن والـ COD والمرتجعات والإعلانات وربط مباشر بالخزينة.
                </p>
              </div>
            </div>
          </div>

          {/* Primary Segmented Navigation Controls */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-950/50 p-1.5 rounded-2xl border border-white/10 self-start lg:self-center">
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
              onClick={() => setActiveTab('transparency')}
              className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'transparency' 
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-900/50' 
                  : 'text-indigo-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles size={15} />
              <span>تقرير الشفافية</span>
              <span className="font-mono text-[10px] bg-white/20 px-1.5 py-0.5 rounded-md text-white">
                جديد
              </span>
            </button>

            <button
              onClick={() => setActiveTab('requests')}
              className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'requests' 
                  ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-900/50' 
                  : 'text-amber-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Coins size={15} />
              <span>طلبات سحب الموكلين</span>
              {pendingMerchantRequestsCount > 0 && (
                <span className="font-mono text-[10px] bg-rose-600 text-white px-2 py-0.5 rounded-full font-black animate-pulse">
                  {pendingMerchantRequestsCount} معلق
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('partners')}
              className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'partners' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' 
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <User size={15} />
              <span>أرصدة الموكلين</span>
            </button>

            <button
              onClick={() => setActiveTab('portal')}
              className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'portal' 
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-900/50' 
                  : 'text-teal-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Globe size={15} />
              <span>بوابة الموكل الإلكترونية</span>
              <span className="font-mono text-[10px] bg-white/20 px-1.5 py-0.5 rounded-md text-white">
                LIVE 🌐
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Alert Banner for Pending Merchant Withdrawal Requests */}
      {pendingMerchantRequestsCount > 0 && activeTab !== 'requests' && (
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
                          st.status === 'draft'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {st.status === 'draft' ? 'مسودة قيد المراجعة' : 'معتمد ومسوّى'}
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
                          setTransparencyMerchantId(st.merchantId || st.merchantName);
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

                      <button
                        onClick={() => handleReverseSettlement(st)}
                        className="p-2.5 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-600 hover:text-white rounded-xl text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                        title="إلغاء الكشف وإعادة فتح الأوردرات"
                      >
                        <RotateCcw size={16} />
                      </button>
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
                اختر الشريك التجاري واضبط قواعد احتساب العمولة والشحن والمرتجعات
              </span>
            </div>

            {/* Quick Partner Selector Strip for Partners with Unsettled Orders */}
            {partnersSummary.some(p => p.unsettledCount > 0) && (
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-600 dark:text-slate-400">
                  وصول سريع للموكلين الذين لديهم أوردرات جاهزة للتسوية:
                </label>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
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
                                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                  {new Date(ord.date).toLocaleDateString('ar-EG')} · {ord.shippingCompany || 'شحن افتراضي'}
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
                    onChange={e => setPayoutChannel(e.target.value as any)}
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
      {activeTab === 'partners' && (
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
                    <div className="flex items-center gap-1.5">
                      <Link
                        to={`/store/${activeStoreId}/suppliers/${partner.id}`}
                        className="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border border-emerald-500/10 shadow-xs"
                        title="عرض محفظة الموكل والتحليلات"
                      >
                        <Wallet size={13} />
                        <span>محفظة الموكل</span>
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
                        title="دخول بوابة الموكل مباشرة لهذا الشريك"
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
                              <div className="font-bold text-slate-800 dark:text-slate-200">{req.typeArabic || 'طلب سحب مستحقات'}</div>
                              {req.notes && (
                                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-1 rounded-lg mt-1 border border-emerald-200 dark:border-emerald-800/50 max-w-md">
                                  {req.notes}
                                </div>
                              )}
                            </td>
                            <td className="py-4 px-3 text-center font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                              {req.amount.toLocaleString()} ج.م
                            </td>
                            <td className="py-4 px-3 text-center">
                              <span className={`inline-flex items-center gap-1 font-black px-3 py-1 rounded-full text-[10px] border ${
                                isPending
                                  ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                                  : isApproved
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                  : 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                              }`}>
                                {isPending ? 'قيد المراجعة ⏳' : isApproved ? 'تم الاعتماد والتحويل ✅' : 'تم الرفض ❌'}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              {isPending ? (
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleApproveMerchantRequest(req)}
                                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all cursor-pointer shadow-xs flex items-center gap-1"
                                  >
                                    <Check size={14} />
                                    <span>اعتماد وتخصيم ✅</span>
                                  </button>
                                  <button
                                    onClick={() => handleRejectMerchantRequest(req.id)}
                                    className="px-3.5 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 font-bold text-xs transition-all cursor-pointer border border-rose-200 dark:border-rose-800 flex items-center gap-1"
                                  >
                                    <X size={14} />
                                    <span>رفض ❌</span>
                                  </button>
                                </div>
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
              const partnerMatch = partnersSummary.find(p => p.id === mId || p.name === mId);
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
      {/* TAB 5: LIVE MERCHANT & PARTNER PORTAL VIEW              */}
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold">
                    {(viewingSettlement.orderSnapshots || []).map(snapshot => (
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
                      </tr>
                    ))}
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

    </div>
  );
};
