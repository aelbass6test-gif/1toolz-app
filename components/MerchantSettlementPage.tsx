import React, { useState, useMemo } from 'react';
import { Settings, Order, MerchantSettlement, MerchantSettlementOrderSnapshot, Treasury, CustomerProfile } from '../types';
import { 
  Building2, DollarSign, Calculator, FileText, CheckCircle2, 
  Printer, Download, Plus, Search, Filter, Calendar, User, 
  ArrowUpRight, ArrowDownLeft, Wallet, ShieldAlert, Sparkles, X, Paperclip, ChevronDown, Check, Speaker
} from 'lucide-react';
import { printHTMLDirectly } from '../utils/printHelper';
import { InvoiceAttachmentUploader } from './InvoiceAttachmentUploader';
import * as XLSX from 'xlsx';
import { calculateCodFee, calculateOrderShippingAndFees, getStandardShippingFee } from '../utils/financials';

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

const calculateMerchantShippingBurden = (order: Order, settings: Settings): number =>
  calculateMerchantShippingBreakdown(order, settings).total;

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
  const [activeTab, setActiveTab] = useState<'settlements' | 'create'>('settlements');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>('');
  
  // New Settlement Form States
  const [flatServiceFee, setFlatServiceFee] = useState<number>(10); // عمولة الأوردر الافتراضية
  const [deductReturnsFee, setDeductReturnsFee] = useState<boolean>(true); // خصم مصاريف شحن المرتجع
  const [returnShippingFeeAmount, setReturnShippingFeeAmount] = useState<number>(35); // رسوم شحن المرتجع
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [selectedTreasuryAccountId, setSelectedTreasuryAccountId] = useState<string>('');
  const [settlementNotes, setSettlementNotes] = useState<string>('');
  const [settlementAttachments, setSettlementAttachments] = useState<string[]>([]);
  const [viewingSettlement, setViewingSettlement] = useState<MerchantSettlement | null>(null);
  const [historyMerchantFilter, setHistoryMerchantFilter] = useState<string>('');
  
  // Lump Sum Ad Spend for Agency Model
  const [lumpSumAdSpend, setLumpSumAdSpend] = useState<number>(0);
  const [batchMarketingFee, setBatchMarketingFee] = useState<number>(0); // مصاريف تسويق لكل أوردر في الكشف
  const [isLumpSumShared, setIsLumpSumShared] = useState<boolean>(true); // هل يتم تقاسم الإعلانات الكلية؟

  // Extract Merchants List (from Suppliers / Customers / Partners / Unique Merchant Names in Orders)
  const merchantsList = useMemo(() => {
    const list: Array<{ id: string; name: string; phone?: string }> = [];
    const seen = new Set<string>();

    // 1. From Suppliers
    (settings.suppliers || []).forEach(s => {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        list.push({ id: s.id, name: s.name, phone: s.phone });
      }
    });

    // 2. From Customers (where debtBalance exists or tagged as merchant)
    customers.forEach(c => {
      if (!seen.has(c.phone) && c.name) {
        seen.add(c.phone);
        list.push({ id: c.phone, name: c.name, phone: c.phone });
      }
    });

    // 3. Unique merchantName from orders
    orders.forEach(o => {
      if (o.merchantName && !seen.has(o.merchantName)) {
        seen.add(o.merchantName);
        list.push({ id: o.merchantId || o.merchantName, name: o.merchantName });
      }
    });

    return list;
  }, [settings.suppliers, customers, orders]);

  // Unsettled Orders for the Selected Merchant
  const eligibleOrders = useMemo(() => {
    if (!selectedMerchantId) return [];

    return orders.filter(o => {
      const isMatch = (o.merchantId === selectedMerchantId || o.merchantName === selectedMerchantId || o.customerName === selectedMerchantId || o.customerPhone === selectedMerchantId);
      const isUnsettled = o.settlementStatus !== 'settled';
      const isEligibleStatus = SETTLEMENT_ELIGIBLE_STATUSES.includes(o.status);
      return isMatch && isUnsettled && isEligibleStatus;
    });
  }, [orders, selectedMerchantId]);

  // Auto-select all eligible orders when merchant changes
  const handleSelectMerchant = (mId: string) => {
    setSelectedMerchantId(mId);
    const mOrders = orders.filter(o => {
      const isMatch = (o.merchantId === mId || o.merchantName === mId || o.customerName === mId || o.customerPhone === mId);
      return isMatch && o.settlementStatus !== 'settled' && SETTLEMENT_ELIGIBLE_STATUSES.includes(o.status);
    });
    setSelectedOrderIds(mOrders.map(o => o.id));
  };

  // Toggle Order Selection
  const toggleOrderSelection = (id: string) => {
    setSelectedOrderIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
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
    const orderSnapshots: MerchantSettlementOrderSnapshot[] = [];

    let netPayoutToMerchant = 0;

    ordersToProcess.forEach(o => {
      const isDelivered = DELIVERED_STATUSES.includes(o.status);
      const isReturn = ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_جزئي', 'مرتجع_بعد_الاستلام', 'ملغي'].includes(o.status);

      // 1. Goods Cost (What the merchant expects for the items)
      const goodsCost = o.merchantItemCost || (o.items || []).reduce((s, i) => s + ((i.cost || 0) * (i.quantity || 1)), 0);
      
      // 2. Shipping & Processing Fees (Carrier fees, VAT, Insurance)
      // لا نخصم سعر الشحن المدفوع من العميل مرة أخرى؛ نحمّل الموكل فقط فرق
      // السعر الرسمي عن السعر المخفض، بالإضافة للرسوم الإضافية لشركة الشحن.
      const shippingBreakdown = calculateMerchantShippingBreakdown(o, settings);
      const shippingAndFees = shippingBreakdown.total;
      
      // 3. Collection Fees (COD fees)
      const codFee = isDelivered ? calculateCodFee(o, settings) : 0;
      
      // 4. Marketing Cost
      const marketingCost = o.marketingFeePerOrder || batchMarketingFee;
      
      // 5. Service Fee (Your flat fee)
      // Only applicable for fixed fee model. In profit share, agent takes % of profit instead of flat fee.
      const serviceFee = (isDelivered && o.merchantSettlementMode !== 'profit_share') 
        ? (o.serviceFeePerOrder !== undefined ? o.serviceFeePerOrder : flatServiceFee) 
        : 0;
      
      // 6. Return Fee
      const returnFee = isReturn && deductReturnsFee ? returnShippingFeeAmount : 0;

      // Track components for the summary UI
      totalServiceFees += serviceFee;
      totalCollectionFees += codFee;
      totalShippingCosts += (shippingAndFees - codFee);
      totalShippingDiscountDifference += shippingBreakdown.shippingDiscountDifference;
      totalCarrierAdditionalFees += shippingBreakdown.carrierAdditionalFees;
      totalMarketingCosts += marketingCost;
      totalReturnFees += returnFee;

      const orderRevenue = isDelivered ? (o.totalPrice || 0) : 0;
      totalCollected += orderRevenue;

      if (o.merchantSettlementMode === 'profit_share') {
        // Profit Sharing Model (نظام مشاركة الأرباح):
        const sharePercent = o.merchantProfitSharePercent || 50;
        const merchantShareRatio = sharePercent / 100;

        // 1. Calculate Gross Profit/Loss
        // Expenses include: Shipping, Insurance, VAT(Tax), Inspection, COD, and Marketing (Ads)
        const allShippingAndFees = shippingAndFees; 
        const allMarketing = marketingCost;
        const totalOutofPocketExpenses = allShippingAndFees + allMarketing + returnFee;
        
        const goodsValueDeduction = isDelivered ? goodsCost : 0;
        
        // Net Profit = Revenue - (Goods Value if Sold) - (Total Out-of-pocket Expenses)
        const netProfitOrLoss = orderRevenue - goodsValueDeduction - totalOutofPocketExpenses;
        
        const merchantProfitShare = netProfitOrLoss * merchantShareRatio;
        
        // Merchant Payout = (Cost of Goods if Sold) + (Their share of the Profit/Loss)
        const orderPayout = (isDelivered ? goodsCost : 0) + merchantProfitShare;
        
        netPayoutToMerchant += orderPayout;
        if (isDelivered) totalMerchantGoodsCost += goodsCost;
      } else {
        // Fixed Fee Model (نظام العمولة الثابتة):
        const totalDeductions = serviceFee + shippingAndFees + marketingCost + returnFee;
        const orderPayout = (isDelivered ? goodsCost : 0) - totalDeductions;
        netPayoutToMerchant += orderPayout;
        
        if (isDelivered) totalMerchantGoodsCost += goodsCost;
      }

      const returnLoss = isReturn ? shippingAndFees + marketingCost + returnFee : 0;
      totalReturnLosses += returnLoss;
      orderSnapshots.push({
        orderId: o.id,
        orderNumber: o.orderNumber,
        date: o.date,
        status: o.status,
        customerName: o.customerName,
        shippingCompany: o.shippingCompany,
        collectedAmount: orderRevenue,
        merchantGoodsCost: isDelivered ? goodsCost : 0,
        customerPaidShipping: shippingBreakdown.customerPaidShipping,
        officialShippingFee: shippingBreakdown.officialShippingFee,
        shippingDiscountDifference: shippingBreakdown.shippingDiscountDifference,
        carrierAdditionalFees: shippingBreakdown.carrierAdditionalFees,
        collectionFee: codFee,
        marketingCost,
        serviceFee,
        returnLoss,
        netMerchantAmount: o.merchantSettlementMode === 'profit_share'
          ? (isDelivered ? goodsCost : 0) + ((orderRevenue - (isDelivered ? goodsCost : 0) - shippingAndFees - marketingCost - returnFee) * ((o.merchantProfitSharePercent || 50) / 100))
          : (isDelivered ? goodsCost : 0) - serviceFee - shippingAndFees - marketingCost - returnFee
      });
    });

    // Finally, handle the lump sum ad spend
    let sharedLumpSumDeduction = lumpSumAdSpend;
    if (isLumpSumShared && ordersToProcess.length > 0) {
      const profitShareOrders = ordersToProcess.filter(o => o.merchantSettlementMode === 'profit_share');
      if (profitShareOrders.length > 0) {
        const avgShare = profitShareOrders.reduce((sum, o) => sum + (o.merchantProfitSharePercent || 50), 0) / profitShareOrders.length;
        sharedLumpSumDeduction = lumpSumAdSpend * (avgShare / 100);
      }
    }

    netPayoutToMerchant -= sharedLumpSumDeduction;

    return {
      ordersCount: ordersToProcess.length,
      totalCollected,
      totalMerchantGoodsCost,
      totalServiceFees,
      totalShippingCosts,
      totalMarketingCosts: totalMarketingCosts + sharedLumpSumDeduction,
      totalReturnFees,
      totalCollectionFees,
      totalShippingDiscountDifference,
      totalCarrierAdditionalFees,
      totalReturnLosses,
      totalOperatorEarnings: totalServiceFees,
      orderSnapshots,
      netPayoutToMerchant
    };
  }, [eligibleOrders, selectedOrderIds, flatServiceFee, deductReturnsFee, returnShippingFeeAmount, lumpSumAdSpend, isLumpSumShared, batchMarketingFee, settings]);

  // Execute Settlement
  const handleExecuteSettlement = () => {
    if (!selectedMerchantId) return alert('يرجى اختيار العميل / صاحب البضاعة أولاً');
    if (selectedOrderIds.length === 0) return alert('يرجى تحديد أوردر واحد على الأقل للتسوية');
    if (settlementCalculation.ordersCount === 0) return alert('الطلبات المحددة غير مؤهلة للتسوية أو تمّت تسويتها بالفعل');
    if (settlementCalculation.netPayoutToMerchant < 0) {
      return alert('لا يمكن اعتماد كشف بصافي مستحق سالب. راجع المصروفات أو سجّل مديونية منفصلة على الموكل قبل إغلاق الطلبات.');
    }

    const merchant = merchantsList.find(m => m.id === selectedMerchantId);
    const mName = merchant ? merchant.name : selectedMerchantId;

    const settlementId = `SETT-${Date.now()}`;
    const settlementNumber = `ST-${String((settings.merchantSettlements || []).length + 1).padStart(5, '0')}`;

    const treasuryAccount = (treasury?.accounts || []).find(a => a.id === selectedTreasuryAccountId);

    const newSettlement: MerchantSettlement = {
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
      status: 'paid',
      paidFromTreasuryAccountId: selectedTreasuryAccountId || undefined,
      paidFromTreasuryAccountName: treasuryAccount?.name || undefined,
      notes: settlementNotes,
      performedBy: currentUser?.fullName || currentUser?.email || 'النظام',
      attachments: settlementAttachments.length > 0 ? settlementAttachments : undefined,
      totalShippingDiscountDifference: settlementCalculation.totalShippingDiscountDifference,
      totalCarrierAdditionalFees: settlementCalculation.totalCarrierAdditionalFees,
      totalReturnLosses: settlementCalculation.totalReturnLosses,
      totalOperatorEarnings: settlementCalculation.totalOperatorEarnings,
      orderSnapshots: settlementCalculation.orderSnapshots
    };

    // Update Orders Status to 'settled'
    // Deduct Net Payout from Treasury Account if selected
    if (selectedTreasuryAccountId && setTreasury && treasury) {
      const newTx = {
        id: `tx-${Date.now()}`,
        date: new Date().toISOString(),
        amount: settlementCalculation.netPayoutToMerchant,
        type: 'withdrawal' as const,
        description: `تسوية حساب الموكل/صاحب البضاعة: ${mName} (كشف ${settlementNumber})`,
        fromAccountId: selectedTreasuryAccountId,
        operatorName: currentUser?.fullName || 'النظام',
        reference: settlementNumber,
        attachments: settlementAttachments
      };

      setTreasury(currentTreasury => ({
        ...currentTreasury,
        accounts: currentTreasury.accounts.map(acc => acc.id === selectedTreasuryAccountId
          ? { ...acc, balance: acc.balance - settlementCalculation.netPayoutToMerchant }
          : acc),
        transactions: [newTx, ...(currentTreasury.transactions || [])]
      }));
    }

    // Update only the selected orders using a functional updater so concurrent
    // changes from another screen are not overwritten.
    setOrders(currentOrders => currentOrders.map(o => selectedOrderIds.includes(o.id)
      ? { ...o, settlementStatus: 'settled' as const, settlementId }
      : o));

    // Save Settlement
    updateSettings(currentSettings => ({
      ...currentSettings,
      merchantSettlements: [newSettlement, ...(currentSettings.merchantSettlements || [])]
    }));

    // Reset Form
    setSelectedMerchantId('');
    setSelectedOrderIds([]);
    setSettlementNotes('');
    setSettlementAttachments([]);
    setLumpSumAdSpend(0);
    setActiveTab('settlements');

    alert(`تم إصدار كشف التسوية المالية رقم (${settlementNumber}) بنجاح وتسجيل المستحقات! ✓`);
  };

  const handlePrintSettlement = (settlement: MerchantSettlement) => {
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>كشف تسوية موكل - ${settlement.settlementNumber}</title>
        <style>
          body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; padding: 25px; color: #1e293b; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: center; border-b: 3px solid #10b981; padding-bottom: 15px; margin-bottom: 20px; }
          .title { font-size: 22px; font-weight: 900; color: #065f46; margin: 0; }
          .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; background: #f0fdf4; padding: 15px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #bbf7d0; font-size: 13px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: right; }
          th { background-color: #10b981; color: white; font-weight: bold; text-align: center; }
          .num { font-family: sans-serif; text-align: center; font-weight: bold; }
          .summary-box { display: flex; justify-content: space-between; background: #d1fae5; border: 2px solid #059669; padding: 15px; border-radius: 12px; margin-top: 25px; font-weight: bold; font-size: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">📄 كشف تسوية ومحاسبة صاحب البضاعة / الموكل</h1>
            <div style="font-size: 13px; color: #64748b; margin-top: 5px;">رقم الكشف: ${settlement.settlementNumber} | التاريخ: ${new Date(settlement.date).toLocaleDateString('ar-EG')}</div>
          </div>
          <div style="font-weight: bold; color: #059669;">${settings.storeName || 'المتجر المركزية'}</div>
        </div>

        <div class="info-grid">
          <div>اسم العميل / الموكل: <span>${settlement.merchantName}</span></div>
          <div>عدد الأوردرات المسواة: <span class="num">${settlement.ordersCount} أوردرات</span></div>
          <div>الخزينة المنصرف منها: <span>${settlement.paidFromTreasuryAccountName || 'تسوية دفتري'}</span></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>إجمالي التحصيل من شركات الشحن</th>
              <th>مستحقات البضاعة لصاحبها</th>
              <th>عمولة الخدمة المخصومة</th>
              <th>مصاريف الشحن واللوجستيات</th>
              <th>رسوم المرتجعات المخصومة</th>
              <th>مصاريف الإعلانات والتسويق</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="num">${settlement.totalCollected.toLocaleString()} ج.م</td>
              <td class="num" style="color: #059669;">${settlement.totalMerchantGoodsCost.toLocaleString()} ج.م</td>
              <td class="num" style="color: #e11d48;">-${settlement.totalServiceFees.toLocaleString()} ج.م</td>
              <td class="num" style="color: #e11d48;">-${settlement.totalShippingCosts.toLocaleString()} ج.م</td>
              <td class="num" style="color: #e11d48;">-${settlement.totalReturnFees.toLocaleString()} ج.م</td>
              <td class="num" style="color: #e11d48;">-${settlement.totalMarketingCosts.toLocaleString()} ج.م</td>
            </tr>
          </tbody>
        </table>

        <table>
          <tbody>
            <tr><td>فرق خصم الشحن الذي يتحمله الموكل</td><td class="num">-${(settlement.totalShippingDiscountDifference || 0).toLocaleString()} ج.م</td></tr>
            <tr><td>رسوم شركة الشحن الإضافية (تأمين / معاينة / ضريبة / غيرها)</td><td class="num">-${(settlement.totalCarrierAdditionalFees || 0).toLocaleString()} ج.م</td></tr>
            <tr><td>إجمالي خسائر المرتجع والفشل</td><td class="num">-${(settlement.totalReturnLosses || 0).toLocaleString()} ج.م</td></tr>
            <tr><td>عمولتي كمقدم خدمة وتشغيل</td><td class="num">${(settlement.totalOperatorEarnings ?? settlement.totalServiceFees).toLocaleString()} ج.م</td></tr>
          </tbody>
        </table>

        <div class="summary-box">
          <span>الصافي النهائي المحول لصاحب البضاعة:</span>
          <span class="num">${settlement.netPayoutToMerchant.toLocaleString()} ج.م</span>
        </div>
      </body>
      </html>
    `;
    printHTMLDirectly(html);
  };
  
  const handleExportSettlementToExcel = (settlement: MerchantSettlement) => {
    // Find orders linked to this settlement
    const settlementOrders = orders.filter(o => o.settlementId === settlement.id);
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
        'عمولة التحصيل': snapshot.collectionFee,
        'مصاريف الإعلانات': snapshot.marketingCost,
        'عمولتي': snapshot.serviceFee,
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
    
    // Summary row
    const summary = [
      {},
      { 'رقم الطلب': 'ملخص الكشف' },
      { 'رقم الطلب': 'إجمالي التحصيل', 'التاريخ': settlement.totalCollected },
      { 'رقم الطلب': 'إجمالي مستحقات البضاعة', 'التاريخ': settlement.totalMerchantGoodsCost },
      { 'رقم الطلب': 'إجمالي عمولة الخدمة', 'التاريخ': settlement.totalServiceFees },
      { 'رقم الطلب': 'إجمالي مصاريف الشحن', 'التاريخ': settlement.totalShippingCosts },
      { 'رقم الطلب': 'فرق خصم الشحن', 'التاريخ': settlement.totalShippingDiscountDifference || 0 },
      { 'رقم الطلب': 'رسوم شركة الشحن الإضافية', 'التاريخ': settlement.totalCarrierAdditionalFees || 0 },
      { 'رقم الطلب': 'إجمالي مصاريف الإعلانات', 'التاريخ': settlement.totalMarketingCosts },
      { 'رقم الطلب': 'إجمالي رسوم المرتجعات', 'التاريخ': settlement.totalReturnFees },
      { 'رقم الطلب': 'إجمالي خسائر المرتجع والفشل', 'التاريخ': settlement.totalReturnLosses || 0 },
      { 'رقم الطلب': 'عمولتي كمقدم خدمة', 'التاريخ': settlement.totalOperatorEarnings ?? settlement.totalServiceFees },
      { 'رقم الطلب': 'الصافي النهائي المحول', 'التاريخ': settlement.netPayoutToMerchant }
    ];

    const ws = XLSX.utils.json_to_sheet([...data, ...summary]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "تفاصيل التسوية");
    XLSX.writeFile(wb, `تسوية_${settlement.settlementNumber}.xlsx`);
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white p-6 sm:p-8 rounded-[2.5rem] shadow-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-black border border-emerald-500/30 inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>نظام الإدارة المالية الشاملة · تسوية حسابات الموكلين والبضائع</span>
          </span>
          <h2 className="text-2xl sm:text-3xl font-black">كشوف تسوية أصحاب البضائع والمنتجات</h2>
          <p className="text-xs text-slate-300 font-medium max-w-xl">
            محاسبة شفافة لصاحب البضاعة بخصم عمولتك ومصاريف الشحن والإعلانات وتحويل الصافي بضغطة زر.
          </p>
        </div>

        <div className="flex items-center gap-2 relative z-10">
          <button
            onClick={() => setActiveTab('settlements')}
            className={`px-5 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer ${
              activeTab === 'settlements' 
                ? 'bg-white text-slate-900 shadow-xl' 
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            سجل كشوف التسوية ({settings.merchantSettlements?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-5 py-3 rounded-2xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'create' 
                ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/30' 
                : 'bg-emerald-600/80 hover:bg-emerald-500 text-white'
            }`}
          >
            <Plus size={16} /> إنشاء كشف تسوية جديد
          </button>
        </div>
      </div>

      {activeTab === 'settlements' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative flex-1 min-w-[240px]">
              <Search size={16} className="absolute right-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="بحث برقم التسوية أو اسم العميل..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <select
                value={historyMerchantFilter}
                onChange={e => setHistoryMerchantFilter(e.target.value)}
                className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              >
                <option value="">جميع العملاء</option>
                {merchantsList.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          {(!settings.merchantSettlements || settings.merchantSettlements.length === 0) ? (
            <div className="p-16 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 font-bold space-y-2">
              <Building2 size={48} className="mx-auto text-slate-300" />
              <div>لا توجد كشوف تسوية مسجلة حتى الآن.</div>
              <button
                onClick={() => setActiveTab('create')}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black inline-block mt-2 cursor-pointer"
              >
                + إصدار أول كشف تسوية
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              {(settings.merchantSettlements || [])
                .filter(st => {
                  const matchSearch = st.settlementNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                    st.merchantName.toLowerCase().includes(searchQuery.toLowerCase());
                  const matchMerchant = !historyMerchantFilter || st.merchantId === historyMerchantFilter;
                  return matchSearch && matchMerchant;
                })
                .map(st => (
                <div key={st.id} className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-base">
                        {st.settlementNumber}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
                        {st.merchantName}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {new Date(st.date).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-medium flex flex-wrap gap-x-4 gap-y-1">
                      <span>عدد الأوردرات: {st.ordersCount}</span>
                      <span>تحصيل: {st.totalCollected.toLocaleString()} ج.م</span>
                      <span>تكلفة بضاعة: {st.totalMerchantGoodsCost.toLocaleString()} ج.م</span>
                      <span className="text-rose-500">إجمالي خصومات: {(st.totalServiceFees + st.totalShippingCosts + st.totalMarketingCosts + st.totalReturnFees).toLocaleString()} ج.م</span>
                      <span className="text-cyan-600">فرق شحن: {(st.totalShippingDiscountDifference || 0).toLocaleString()} ج.م</span>
                      <span className="text-red-500">خسائر مرتجع: {(st.totalReturnLosses || 0).toLocaleString()} ج.م</span>
                      <span className="text-amber-600">عمولتي: {(st.totalOperatorEarnings ?? st.totalServiceFees).toLocaleString()} ج.م</span>
                      <span>الخزينة: {st.paidFromTreasuryAccountName || 'تسوية دفتري'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end md:self-center">
                    <div className="text-left">
                      <div className="text-lg font-black text-slate-900 dark:text-white font-mono">
                        {st.netPayoutToMerchant.toLocaleString()} <span className="text-xs text-slate-400">ج.م</span>
                      </div>
                      <div className="text-[10px] text-emerald-600 font-bold">الصافي المحول</div>
                    </div>

                    <button
                      onClick={() => setViewingSettlement(st)}
                      className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-cyan-600 hover:text-white rounded-xl text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                      title="عرض تفاصيل الكشف"
                    >
                      <FileText size={16} />
                    </button>

                    <button
                      onClick={() => handlePrintSettlement(st)}
                      className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white rounded-xl text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                      title="طباعة الكشف"
                    >
                      <Printer size={16} />
                    </button>
                    
                    <button
                      onClick={() => handleExportSettlementToExcel(st)}
                      className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white rounded-xl text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                      title="تصدير Excel"
                    >
                      <Download size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CREATE NEW SETTLEMENT */}
      {activeTab === 'create' && (
        <div className="space-y-6">
          {/* Step 1: Select Merchant & General Settings */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="font-black text-slate-800 dark:text-white text-base flex items-center gap-2">
              <User size={18} className="text-emerald-500" /> 1. تحديد العميل / صاحب البضاعة ومعايير الخصم
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5">اختر العميل / صاحب البضاعة</label>
                <select
                  value={selectedMerchantId}
                  onChange={e => handleSelectMerchant(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- اختر صاحب البضاعة --</option>
                  {merchantsList.map(m => (
                    <option key={m.id} value={m.id}>{m.name} {m.phone ? `(${m.phone})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5">عمولة الخدمة للطلب المسلم (ج.م)</label>
                <input
                  type="number"
                  value={flatServiceFee}
                  onChange={e => setFlatServiceFee(Number(e.target.value) || 0)}
                  placeholder="30"
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-xs text-center outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5">خصم شحن المرتجعات</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDeductReturnsFee(!deductReturnsFee)}
                    className={`px-4 py-3 rounded-2xl font-bold text-xs flex-1 transition-all ${
                      deductReturnsFee ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {deductReturnsFee ? 'تفعيل خصم المرتجع' : 'إلغاء الخصم'}
                  </button>
                  {deductReturnsFee && (
                    <input
                      type="number"
                      value={returnShippingFeeAmount}
                      onChange={e => setReturnShippingFeeAmount(Number(e.target.value) || 0)}
                      className="w-20 p-3 bg-slate-50 dark:bg-slate-800 border rounded-2xl font-black text-xs text-center"
                      title="رسوم شحن المرتجع"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5">مصاريف التسويق لكل أوردر (ج.م)</label>
                <div className="relative">
                  <Speaker size={14} className="absolute left-3.5 top-3.5 text-orange-500" />
                  <input
                    type="number"
                    value={batchMarketingFee || ''}
                    onChange={e => setBatchMarketingFee(Number(e.target.value) || 0)}
                    placeholder="مثلاً 30 ج.م لكل أوردر..."
                    className="w-full pl-10 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-bold mt-1.5">سيتم تطبيق هذا المبلغ على أي أوردر لا يحتوي على مصاريف إعلانات مسجلة.</p>
              </div>

              <div>
                <label className="block text-xs font-black text-emerald-600 mb-1.5 uppercase">إجمالي مصاريف الإعلانات المخصومة (ج.م)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <DollarSign size={14} className="absolute left-3.5 top-3.5 text-emerald-500" />
                    <input
                      type="number"
                      value={lumpSumAdSpend || ''}
                      onChange={e => setLumpSumAdSpend(Number(e.target.value) || 0)}
                      placeholder="إجمالي صرف الإعلانات..."
                      className="w-full pl-10 pr-4 py-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl font-black text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLumpSumShared(!isLumpSumShared)}
                    className={`px-4 rounded-2xl text-[10px] font-black border transition-all ${
                      isLumpSumShared 
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/20' 
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    {isLumpSumShared ? 'تقاسم (Shared)' : 'كامل (Full)'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 font-bold mt-1.5 mr-1">
                  {isLumpSumShared 
                    ? "سيتم خصم نسبة من هذا المبلغ من الموكل حسب نسبة مشاركته في الربح." 
                    : "سيتم خصم هذا المبلغ بالكامل من مستحقات الموكل."}
                </p>
              </div>
            </div>

            {selectedMerchantId && eligibleOrders.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-800">
                  <div className="text-[10px] font-black text-indigo-500 uppercase mb-1">إجمالي الأوردرات المعلقة</div>
                  <div className="text-lg font-black text-indigo-700 dark:text-indigo-400 font-mono">{eligibleOrders.length} أوردر</div>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800">
                  <div className="text-[10px] font-black text-emerald-500 uppercase mb-1">إجمالي التحصيل المتوقع</div>
                  <div className="text-lg font-black text-emerald-700 dark:text-emerald-400 font-mono">
                    {eligibleOrders.reduce((sum, o) => sum + (['تم_التحصيل', 'مدفوعة', 'تم_التوصيل'].includes(o.status) ? (o.totalPrice || 0) : 0), 0).toLocaleString()} ج.م
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-800">
                  <div className="text-[10px] font-black text-amber-500 uppercase mb-1">إجمالي تكلفة البضاعة</div>
                  <div className="text-lg font-black text-amber-700 dark:text-amber-400 font-mono">
                    {eligibleOrders.reduce((sum, o) => sum + (o.merchantItemCost || (o.items || []).reduce((s, i) => s + ((i.cost || 0) * (i.quantity || 1)), 0)), 0).toLocaleString()} ج.م
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Select Orders Table */}
          {selectedMerchantId && (
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-black text-slate-800 dark:text-white text-base flex items-center gap-2">
                  <FileText size={18} className="text-emerald-500" /> 2. اختيار الأوردرات الجاهزة للتسوية ({eligibleOrders.length} أوردر)
                </h3>
                <button
                  onClick={() => setSelectedOrderIds(selectedOrderIds.length === eligibleOrders.length ? [] : eligibleOrders.map(o => o.id))}
                  className="text-xs font-black text-emerald-600 hover:underline cursor-pointer"
                >
                  {selectedOrderIds.length === eligibleOrders.length ? 'إلغاء تحديد الكل' : 'تحديد جميع الأوردرات'}
                </button>
              </div>

              {eligibleOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-bold bg-slate-50 dark:bg-slate-800/30 rounded-2xl text-xs">
                  لا توجد أوردرات معلقة تحتاج تسوية مع هذا العميل حالياً.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black">
                      <tr>
                        <th className="p-3 text-center w-10">تحديد</th>
                        <th className="p-3">رقم الطلب</th>
                        <th className="p-3">نظام المحاسبة</th>
                        <th className="p-3">التاريخ</th>
                        <th className="p-3 text-center">التحصيل (ج.م)</th>
                        <th className="p-3 text-center">تكلفة البضاعة</th>
                        <th className="p-3 text-center">المصاريف</th>
                        <th className="p-3 text-center">المستحق</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold">
                      {eligibleOrders.map(ord => {
                        const isSelected = selectedOrderIds.includes(ord.id);
                        const isDelivered = ['تم_التحصيل', 'مدفوعة', 'تم_التوصيل'].includes(ord.status);
                        const total = ord.totalPrice || 0;
                        const goodsCost = ord.merchantItemCost || (ord.items || []).reduce((s, i) => s + ((i.cost || 0) * (i.quantity || 1)), 0);

                        return (
                          <tr
                            key={ord.id}
                            onClick={() => toggleOrderSelection(ord.id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="p-3 text-center">
                              <div className={`w-5 h-5 rounded-md mx-auto flex items-center justify-center border ${
                                isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300'
                              }`}>
                                {isSelected && <Check size={12} />}
                              </div>
                            </td>
                            <td className="p-3 font-mono font-black text-indigo-600">#{ord.orderNumber || ord.id.slice(0, 8)}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                ord.merchantSettlementMode === 'profit_share' 
                                  ? 'bg-indigo-100 text-indigo-800' 
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {ord.merchantSettlementMode === 'profit_share' 
                                  ? `مشاركة (${ord.merchantProfitSharePercent || 50}%)` 
                                  : 'عمولة ثابتة'}
                              </span>
                            </td>
                            <td className="p-3 text-slate-400 font-mono">{new Date(ord.date).toLocaleDateString('ar-EG')}</td>
                            <td className="p-3 text-center font-mono">{isDelivered ? `${total.toLocaleString()} ج.م` : '-'}</td>
                            <td className="p-3 text-center font-mono text-emerald-600">{goodsCost > 0 ? `${goodsCost.toLocaleString()} ج.م` : '-'}</td>
                            <td className="p-3 text-center font-mono text-amber-600">
                              {(() => {
                                const exp = calculateOrderShippingAndFees(ord, settings) + (ord.marketingFeePerOrder || 0);
                                return `${exp.toLocaleString()} ج.م`;
                              })()}
                            </td>
                            <td className="p-3 text-center font-mono text-indigo-600">
                              {(() => {
                                // Quick per-order payout preview for the table
                                const isDelivered = DELIVERED_STATUSES.includes(ord.status);
                                const isReturn = ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_جزئي', 'مرتجع_بعد_الاستلام', 'ملغي'].includes(ord.status);
                                const gc = ord.merchantItemCost || (ord.items || []).reduce((s, i) => s + ((i.cost || 0) * (i.quantity || 1)), 0);
                                const shippingAndFees = calculateMerchantShippingBurden(ord, settings);
                                const marketingCost = ord.marketingFeePerOrder || batchMarketingFee;
                                const returnFee = isReturn && deductReturnsFee ? returnShippingFeeAmount : 0;
                                const serviceFee = isDelivered && ord.merchantSettlementMode !== 'profit_share'
                                  ? (ord.serviceFeePerOrder !== undefined ? ord.serviceFeePerOrder : flatServiceFee)
                                  : 0;
                                const revenue = isDelivered ? (ord.totalPrice || 0) : 0;
                                
                                if (ord.merchantSettlementMode === 'profit_share') {
                                  const totalExp = shippingAndFees + marketingCost + returnFee;
                                  const profit = revenue - gc - totalExp;
                                  const payout = (isDelivered ? gc : 0) + (profit * (ord.merchantProfitSharePercent || 50) / 100);
                                  return `${Math.round(payout).toLocaleString()} ج.م`;
                                } else {
                                  const totalDeductions = serviceFee + shippingAndFees + marketingCost + returnFee;
                                  const payout = (isDelivered ? gc : 0) - totalDeductions;
                                  return `${Math.round(payout).toLocaleString()} ج.م`;
                                }
                              })()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Calculation & Treasury Payout */}
          {selectedOrderIds.length > 0 && (
            <div className="p-6 rounded-3xl bg-slate-900 text-white space-y-6">
              <h3 className="font-black text-lg flex items-center gap-2 text-emerald-400">
                <Calculator size={20} /> 3. ملخص الموازنة والمستحق للتحويل
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-bold">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                  <span className="text-slate-400">إجمالي التحصيل</span>
                  <div className="text-xl font-black text-white font-mono">{settlementCalculation.totalCollected.toLocaleString()} ج.م</div>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                  <span className="text-amber-400">فرق الشحن والرسوم الإضافية</span>
                  <div className="text-xl font-black text-white font-mono">-{settlementCalculation.totalShippingCosts.toLocaleString()} ج.م</div>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                  <span className="text-orange-400">عمولات تحصيل COD</span>
                  <div className="text-xl font-black text-orange-400 font-mono">-{settlementCalculation.totalCollectionFees.toLocaleString()} ج.م</div>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                  <span className="text-rose-400">إجمالي عمولة الوكالة</span>
                  <div className="text-xl font-black text-rose-400 font-mono">-{settlementCalculation.totalServiceFees.toLocaleString()} ج.م</div>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                  <span className="text-emerald-400">مستحقات البضاعة</span>
                  <div className="text-xl font-black text-emerald-400 font-mono">{settlementCalculation.totalMerchantGoodsCost.toLocaleString()} ج.م</div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 space-y-1">
                  <span className="text-emerald-300">الصافي النهائي للعميل</span>
                  <div className="text-2xl font-black text-emerald-400 font-mono">{settlementCalculation.netPayoutToMerchant.toLocaleString()} ج.م</div>
                </div>

                <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 space-y-1">
                  <span className="text-cyan-300">فرق خصم الشحن</span>
                  <div className="text-xl font-black text-cyan-300 font-mono">{settlementCalculation.totalShippingDiscountDifference.toLocaleString()} ج.م</div>
                </div>
                <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/30 space-y-1">
                  <span className="text-violet-300">رسوم شركة الشحن الإضافية</span>
                  <div className="text-xl font-black text-violet-300 font-mono">{settlementCalculation.totalCarrierAdditionalFees.toLocaleString()} ج.م</div>
                </div>
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-1">
                  <span className="text-red-300">خسائر المرتجع والفشل</span>
                  <div className="text-xl font-black text-red-300 font-mono">{settlementCalculation.totalReturnLosses.toLocaleString()} ج.م</div>
                </div>
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                  <span className="text-amber-300">عمولتي كمقدم خدمة</span>
                  <div className="text-xl font-black text-amber-300 font-mono">{settlementCalculation.totalOperatorEarnings.toLocaleString()} ج.م</div>
                </div>
              </div>

              {/* Treasury Option */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/10">
                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1.5">خصم وصرف الصافي من خزينة</label>
                  <select
                    value={selectedTreasuryAccountId}
                    onChange={e => setSelectedTreasuryAccountId(e.target.value)}
                    className="w-full p-3.5 bg-slate-800 border border-slate-700 rounded-2xl font-bold text-xs text-white outline-none focus:border-emerald-500"
                  >
                    <option value="">-- تسوية دفتري بدون خصم خزينة --</option>
                    {(treasury?.accounts || []).map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} (رصيد: {acc.balance.toLocaleString()} ج.م)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1.5">ملاحظات الكشف</label>
                  <input
                    type="text"
                    placeholder="مثال: تم التحويل عبر فودافون كاش / إنستاباي..."
                    value={settlementNotes}
                    onChange={e => setSettlementNotes(e.target.value)}
                    className="w-full p-3.5 bg-slate-800 border border-slate-700 rounded-2xl font-medium text-xs text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Attachments */}
              <div className="pt-2">
                <InvoiceAttachmentUploader
                  label="إرفاق صورة إيصال التحويل النقدية/البنكي (اختياري)"
                  helperText="يمكنك التقاط صورة إشعار التحويل وتأكيده مع الكشف"
                  attachments={settlementAttachments}
                  onChange={setSettlementAttachments}
                  activeStoreId="store-merchant-settlements"
                  folderCategory="expenses"
                  maxFiles={3}
                  compact
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleExecuteSettlement}
                  className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black rounded-2xl text-sm shadow-xl shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle2 size={18} /> اعتماد وتأكيد كشف التسوية وصرف الصافي
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {viewingSettlement && (
        <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewingSettlement(null)}>
          <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-700" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 z-10 p-5 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">تفاصيل كشف {viewingSettlement.settlementNumber}</h3>
                <p className="text-xs text-slate-500 mt-1">{viewingSettlement.merchantName} · لقطة محفوظة وقت الاعتماد</p>
              </div>
              <button onClick={() => setViewingSettlement(null)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  ['التحصيل', viewingSettlement.totalCollected],
                  ['فرق خصم الشحن', viewingSettlement.totalShippingDiscountDifference || 0],
                  ['رسوم إضافية', viewingSettlement.totalCarrierAdditionalFees || 0],
                  ['عمولتي', viewingSettlement.totalOperatorEarnings ?? viewingSettlement.totalServiceFees],
                  ['الإعلانات', viewingSettlement.totalMarketingCosts],
                  ['خسائر المرتجع', viewingSettlement.totalReturnLosses || 0],
                  ['مستحق البضاعة', viewingSettlement.totalMerchantGoodsCost],
                  ['الصافي للموكل', viewingSettlement.netPayoutToMerchant]
                ].map(([label, value]) => (
                  <div key={String(label)} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] font-bold text-slate-500">{label}</div>
                    <div className="mt-1 font-black font-mono text-slate-900 dark:text-white">{Number(value).toLocaleString()} ج.م</div>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-right text-xs min-w-[900px]">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-black">
                    <tr><th className="p-3">الطلب</th><th className="p-3">الحالة</th><th className="p-3">المحصل</th><th className="p-3">فرق الشحن</th><th className="p-3">رسوم إضافية</th><th className="p-3">إعلانات</th><th className="p-3">خسارة المرتجع</th><th className="p-3">الصافي</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(viewingSettlement.orderSnapshots || []).map(snapshot => (
                      <tr key={snapshot.orderId}>
                        <td className="p-3 font-mono font-bold">#{snapshot.orderNumber || snapshot.orderId.slice(0, 8)}</td>
                        <td className="p-3">{snapshot.status}</td>
                        <td className="p-3 font-mono">{snapshot.collectedAmount.toLocaleString()}</td>
                        <td className="p-3 font-mono text-cyan-600">{snapshot.shippingDiscountDifference.toLocaleString()}</td>
                        <td className="p-3 font-mono text-violet-600">{snapshot.carrierAdditionalFees.toLocaleString()}</td>
                        <td className="p-3 font-mono text-orange-600">{snapshot.marketingCost.toLocaleString()}</td>
                        <td className="p-3 font-mono text-red-600">{snapshot.returnLoss.toLocaleString()}</td>
                        <td className="p-3 font-mono font-black text-emerald-600">{snapshot.netMerchantAmount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!viewingSettlement.orderSnapshots || viewingSettlement.orderSnapshots.length === 0) && <div className="p-8 text-center text-xs text-slate-500">هذا كشف قديم قبل تفعيل اللقطات التفصيلية.</div>}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
