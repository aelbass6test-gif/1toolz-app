import React, { useState, useMemo } from 'react';
import { Settings, Order, MerchantSettlement, MerchantSettlementOrderSnapshot, Treasury, CustomerProfile } from '../types';
import { 
  Building2, DollarSign, Calculator, FileText, CheckCircle2, 
  Printer, Download, Plus, Search, Filter, Calendar, User, 
  ArrowUpRight, ArrowDownLeft, Wallet, ShieldAlert, Sparkles, X, Paperclip, ChevronDown, Check, Speaker,
  Landmark, TrendingUp, TrendingDown, RefreshCw, MessageSquare, RotateCcw, Eye, SlidersHorizontal,
  Layers, Percent, PackageCheck, AlertTriangle, Trash2, ExternalLink, FileSpreadsheet, Info
} from 'lucide-react';
import { printHTMLDirectly } from '../utils/printHelper';
import { InvoiceAttachmentUploader } from './InvoiceAttachmentUploader';
import * as XLSX from 'xlsx';
import { calculateCodFee, calculateOrderShippingAndFees, getStandardShippingFee } from '../utils/financials';
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

/**
 * تكلفة الشحن المحملة على الموكل:
 * السعر الرسمي لشركة الشحن ناقص ما دفعه العميل بعد الخصم،
 * مضافاً إليه الرسوم الإضافية الفعلية (تأمين/معاينة/VAT وغيرها).
 */
const calculateMerchantShippingBreakdown = (order: Order, settings: Settings) => {
  if (!DELIVERED_STATUSES.includes(order.status)) {
    const total = calculateOrderShippingAndFees(order, settings);
    return {
      total,
      customerPaidShipping: 0,
      officialShippingFee: Math.max(0, getStandardShippingFee(order, settings)),
      shippingDiscountDifference: 0,
      carrierAdditionalFees: total
    };
  }

  const customerPaidShipping = Math.max(0, Number(order.shippingFee) || 0);
  const officialShippingFee = Math.max(0, getStandardShippingFee(order, settings));
  const actualCarrierFees = calculateOrderShippingAndFees({
    ...order,
    shippingFee: officialShippingFee,
    isManualShippingOverride: false
  }, settings);

  const shippingDiscountDifference = Math.max(0, officialShippingFee - customerPaidShipping);
  const additionalCarrierFees = Math.max(0, actualCarrierFees - officialShippingFee);
  return {
    total: Math.round((shippingDiscountDifference + additionalCarrierFees) * 100) / 100,
    customerPaidShipping,
    officialShippingFee,
    shippingDiscountDifference: Math.round(shippingDiscountDifference * 100) / 100,
    carrierAdditionalFees: Math.round(additionalCarrierFees * 100) / 100
  };
};

interface OrderCustomOverride {
  goodsCost?: number;
  marketingFee?: number;
  serviceFee?: number;
  mode?: 'fixed_fee' | 'profit_share';
  sharePercent?: number;
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
  const [activeTab, setActiveTab] = useState<'settlements' | 'create' | 'partners'>('settlements');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>('');
  
  // History Filters
  const [historyMerchantFilter, setHistoryMerchantFilter] = useState<string>('');
  const [historyDateFilter, setHistoryDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'paid' | 'draft'>('all');

  // New Settlement Form States
  const [flatServiceFee, setFlatServiceFee] = useState<number>(10); // عمولة الأوردر الافتراضية
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
  const [batchAccountingMode, setBatchAccountingMode] = useState<'order_default' | 'fixed_fee' | 'profit_share'>('order_default');
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
  const [newPartnerDefaultMarketing, setNewPartnerDefaultMarketing] = useState<number>(0);

  // Extract Merchants List strictly from:
  // 1. Registered Suppliers / Partners (settings.suppliers)
  // 2. Customers explicitly tagged as 'merchant' / 'موكل' / 'صاحب بضاعة'
  // 3. Unique merchantId / merchantName assigned on orders (excluding 'pending')
  // 4. Historical settlements (settings.merchantSettlements)
  const merchantsList = useMemo(() => {
    const list: Array<{ id: string; name: string; phone?: string; sourceLabel?: string }> = [];
    const seen = new Set<string>();

    // 1. From Suppliers / Partners
    (settings.suppliers || []).forEach(s => {
      if (s.id && s.name && !seen.has(s.id)) {
        seen.add(s.id);
        seen.add(s.name.trim());
        list.push({ id: s.id, name: s.name.trim(), phone: s.phone, sourceLabel: 'مورد / صاحب بضاعة' });
      }
    });

    // 2. From Customers ONLY if explicitly marked as a merchant / partner (never regular store buyers!)
    customers.forEach(c => {
      const isTaggedMerchant =
        c.customerSegment === 'merchant' ||
        (Array.isArray(c.tags) && c.tags.some(t => ['موكل', 'صاحب بضاعة', 'تاجر', 'شريك', 'merchant', 'partner'].includes(String(t).trim().toLowerCase())));
      if (isTaggedMerchant && c.phone && c.name && !seen.has(c.phone) && !seen.has(c.name.trim())) {
        seen.add(c.phone);
        seen.add(c.name.trim());
        list.push({ id: c.phone, name: c.name.trim(), phone: c.phone, sourceLabel: 'موكل مسجل' });
      }
    });

    // 3. Unique merchantId / merchantName from agency orders
    orders.forEach(o => {
      const mName = (o.merchantName || '').trim();
      const mId = (o.merchantId || '').trim();
      if (mName && mId !== 'pending' && !seen.has(mName) && (!mId || !seen.has(mId))) {
        seen.add(mName);
        if (mId) seen.add(mId);
        list.push({ id: mId || mName, name: mName, sourceLabel: 'موكل أوردرات' });
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
  }, [settings.suppliers, settings.merchantSettlements, customers, orders]);

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
    const newPartner = {
      id: newId,
      name: newPartnerName.trim(),
      phone: newPartnerPhone.trim(),
      email: '',
      address: '',
      notes: 'موكل / صاحب بضاعة (تمت إضافته من شاشة التسويات)',
      defaultMarketingFeePerOrder: newPartnerDefaultMarketing > 0 ? newPartnerDefaultMarketing : undefined
    };

    updateSettings(prev => ({
      ...prev,
      suppliers: [newPartner, ...(prev.suppliers || [])]
    }));

    setSelectedMerchantId(newId);
    setNewPartnerName('');
    setNewPartnerPhone('');
    setNewPartnerDefaultMarketing(0);
    setShowAddPartnerModal(false);
    inAppToast(`تم تسجيل الموكل "${newPartner.name}" بنجاح.`, 'success');
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
    const effectiveMode: 'fixed_fee' | 'profit_share' = ov.mode
      ? ov.mode
      : batchAccountingMode !== 'order_default'
      ? batchAccountingMode
      : o.merchantSettlementMode === 'profit_share'
      ? 'profit_share'
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
    const shippingBreakdown = calculateMerchantShippingBreakdown(o, settings);
    const shippingAndFees = shippingBreakdown.total;

    // 3. Collection Fees (COD fees)
    const codFee = isDelivered ? calculateCodFee(o, settings) : 0;

    // 4. Marketing Cost
    const defaultMarketing = o.marketingFeePerOrder !== undefined && o.marketingFeePerOrder > 0 ? o.marketingFeePerOrder : batchMarketingFee;
    const marketingCost = ov.marketingFee !== undefined ? ov.marketingFee : defaultMarketing;

    // 5. Service Fee
    const defaultServiceFee = o.serviceFeePerOrder !== undefined ? o.serviceFeePerOrder : flatServiceFee;
    const serviceFee = (isDelivered && effectiveMode !== 'profit_share')
      ? (ov.serviceFee !== undefined ? ov.serviceFee : defaultServiceFee)
      : 0;

    // 6. Return Fee
    const returnFee = isReturn && deductReturnsFee ? returnShippingFeeAmount : 0;

    const orderRevenue = isDelivered ? (o.totalPrice || 0) : 0;

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
    } else {
      const totalDeductions = serviceFee + shippingAndFees + marketingCost + returnFee;
      orderPayout = (isDelivered ? goodsCost : 0) - totalDeductions;
    }

    const returnLoss = isReturn ? shippingAndFees + marketingCost + returnFee : 0;

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

    ordersToProcess.forEach(o => {
      const calc = computeOrderFinancials(o);

      if (calc.isDelivered) deliveredOrdersCount++;
      if (calc.isReturn) returnOrdersCount++;

      totalServiceFees += calc.serviceFee;
      totalOperatorEarnings += calc.operatorOrderEarning;
      totalCollectionFees += calc.codFee;
      totalShippingCosts += (calc.shippingAndFees - calc.codFee);
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
        marketingCost: calc.marketingCost,
        serviceFee: calc.serviceFee,
        returnLoss: calc.returnLoss,
        netMerchantAmount: calc.orderPayout
      });
    });

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
        sharedLumpSumDeduction = lumpSumAdSpend * 0.5;
      }
    }

    netPayoutToMerchant -= sharedLumpSumDeduction;

    const totalAllDeductions =
      totalServiceFees +
      totalShippingCosts +
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
        ...(ov?.mode !== undefined ? { merchantSettlementMode: ov.mode } : {}),
        ...(ov?.sharePercent !== undefined ? { merchantProfitSharePercent: ov.sharePercent } : {})
      };
    }));

    // Save Settlement
    updateSettings(currentSettings => ({
      ...currentSettings,
      merchantSettlements: [newSettlement, ...(currentSettings.merchantSettlements || [])]
    }));

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
      `• مصاريف الشحن واللوجستيات: -${settlement.totalShippingCosts.toLocaleString()} ج.م`,
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
            <td>${s.status}</td>
            <td class="num">${s.collectedAmount.toLocaleString()}</td>
            <td class="num" style="color:#008060;">${s.merchantGoodsCost.toLocaleString()}</td>
            <td class="num" style="color:#b45309;">-${(s.shippingDiscountDifference + s.carrierAdditionalFees + s.collectionFee).toLocaleString()}</td>
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
              <th>فروق ورسوم الشحن</th>
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
                <th>الشحن وCOD</th>
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
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. EXECUTIVE FINANCIAL KPI STRIP                         */}
      {/* ======================================================== */}
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
                                    onClick={() => updateOrderOverride(ord.id, {
                                      mode: calc.effectiveMode === 'profit_share' ? 'fixed_fee' : 'profit_share'
                                    })}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition-colors cursor-pointer ${
                                      calc.effectiveMode === 'profit_share'
                                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                        : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                    }`}
                                    title="اضغط للتبديل بين العمولة الثابتة ومشاركة الأرباح لهذا الأوردر"
                                  >
                                    {calc.effectiveMode === 'profit_share'
                                      ? `مشاركة (${calc.effectiveSharePercent}%)`
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

                            {/* Expandable Order Financial Formula Row */}
                            {isExpanded && (
                              <tr className="bg-slate-50/90 dark:bg-slate-800/60">
                                <td colSpan={10} className="p-4">
                                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-[11px]">
                                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                      <span className="text-slate-400 block">الشحن المدفوع من العميل</span>
                                      <strong className="font-mono text-slate-800 dark:text-white">{calc.shippingBreakdown.customerPaidShipping.toLocaleString()} ج.م</strong>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                      <span className="text-slate-400 block">السعر الرسمي لشركة الشحن</span>
                                      <strong className="font-mono text-slate-800 dark:text-white">{calc.shippingBreakdown.officialShippingFee.toLocaleString()} ج.م</strong>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                      <span className="text-slate-400 block">فرق خصم الشحن المحمل</span>
                                      <strong className="font-mono text-amber-600">-{calc.shippingBreakdown.shippingDiscountDifference.toLocaleString()} ج.م</strong>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                      <span className="text-slate-400 block">رسوم شحن إضافية وتأمين</span>
                                      <strong className="font-mono text-amber-600">-{calc.shippingBreakdown.carrierAdditionalFees.toLocaleString()} ج.م</strong>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                      <span className="text-slate-400 block">عمولة تحصيل COD</span>
                                      <strong className="font-mono text-amber-600">-{calc.codFee.toLocaleString()} ج.م</strong>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                      <span className="text-slate-400 block">عمولة الخدمة / حصة النظام</span>
                                      <strong className="font-mono text-indigo-600">{calc.operatorOrderEarning.toLocaleString()} ج.م</strong>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                                      <span className="text-emerald-700 dark:text-emerald-300 block">صافي مستحق الموكل بالطلب</span>
                                      <strong className="font-mono text-emerald-700 dark:text-emerald-300">{calc.orderPayout.toLocaleString()} ج.م</strong>
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

                {/* 3. Shipping Differences & Carrier Fees */}
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between text-amber-300">
                    <span>فروق الشحن ورسوم الشركة</span>
                    <ArrowDownLeft size={15} className="text-amber-400" />
                  </div>
                  <div className="text-xl font-black text-amber-400 font-mono tabular-nums">
                    -{settlementCalculation.totalShippingCosts.toLocaleString()} <span className="text-xs text-slate-400">ج.م</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    فرق خصم: {settlementCalculation.totalShippingDiscountDifference.toLocaleString()} · إضافية: {settlementCalculation.totalCarrierAdditionalFees.toLocaleString()}
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
            <button
              type="button"
              onClick={() => setShowAddPartnerModal(true)}
              className="px-4 py-2.5 rounded-xl bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black flex items-center gap-2 self-start sm:self-center cursor-pointer shadow-xs"
            >
              <Plus size={15} />
              <span>تسجيل موكل / صاحب بضاعة جديد</span>
            </button>
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
              ))}
            </div>
          )}
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
