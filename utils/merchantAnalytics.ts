import { Order, Settings, OrderItem } from '../types';
import { 
  calculateCodFee, 
  getStandardShippingFee, 
  getCompanySpecificFees, 
  calculateInsuranceFee, 
  calculateBostaVat 
} from './financials';
import * as XLSX from 'xlsx';
import { printHTMLDirectly } from './printHelper';

export const TRANSPARENCY_DELIVERED_STATUSES = ['تم_التحصيل', 'مدفوعة', 'تم_التوصيل', 'تم_توصيلها'];
export const TRANSPARENCY_RETURN_STATUSES = [
  'مرتجع',
  'فشل_التوصيل',
  'تمت_الاعادة_لشركة_الشحن',
  'مرتجع_جزئي',
  'مرتجع_بعد_الاستلام',
  'ملغي'
];

export interface ProductMovementItem {
  productId: string;
  sku: string;
  name: string;
  image?: string;
  totalQuantityOrdered: number;
  quantityDelivered: number;
  totalDeliveredSales: number;
  totalDeliveredCost: number;
  quantityReturned: number;
  returnRate: number;
  allocatedExpenses: number;
  netProfit: number;
}

export interface TransparencyOrderRow {
  orderId: string;
  orderNumber: string;
  date: string;
  customerName: string;
  customerPhone?: string;
  city?: string;
  shippingCompany?: string;
  status: string;
  isDelivered: boolean;
  isReturn: boolean;
  itemsSummary: string;
  itemsCount: number;
  rawItems: OrderItem[];
  collectedAmount: number;
  merchantGoodsCost: number;
  baseShippingFee: number;
  insuranceFee: number;
  inspectionFee: number;
  vatFee: number;
  codFee: number;
  carrierAdditionalFees: number;
  totalShippingAndCarrier: number;
  serviceFee: number;
  marketingFee: number;
  returnLoss: number;
  netMerchantAmount: number;
  merchantProfitOrLoss: number;
  settlementStatus?: string;
  settlementId?: string;
  rawOrder?: Order;
}

export interface TransparencyAnalyticsResult {
  merchantIdentifier: string;
  merchantDisplayName: string;
  dateRangeLabel: string;
  totalOrdersCount: number;
  deliveredCount: number;
  returnCount: number;
  pendingDeliveryCount: number;
  deliverySuccessRate: number;
  returnRate: number;

  // Financial aggregates
  totalCollected: number;
  totalGoodsCostRecovered: number;
  totalBaseShipping: number;
  totalCarrierAdditionalFees: number;
  totalInsurance: number;
  totalInspection: number;
  totalVat: number;
  totalCodFees: number;
  totalShippingAndCarrier: number;
  totalServiceFees: number;
  totalMarketingCosts: number;
  totalReturnLosses: number;
  totalAllDeductions: number;

  // Net results
  netPayoutToMerchant: number;
  merchantNetProfitOrLoss: number;
  roiPercentage: number;

  // Granular data
  productMovements: ProductMovementItem[];
  orderRows: TransparencyOrderRow[];
}

export interface TransparencyFilterOptions {
  dateRange?: 'today' | '7days' | 'month' | 'all' | 'custom';
  startDate?: string;
  endDate?: string;
  settlementStatus?: 'all' | 'settled' | 'unsettled';
  searchTerm?: string;
}

/**
 * Helper to compute single order shipping and carrier breakdown
 */
export function computeOrderCarrierBreakdown(order: Order, settings: Settings) {
  const isDelivered = TRANSPARENCY_DELIVERED_STATUSES.includes(order.status);
  const compFees = getCompanySpecificFees(settings, order.shippingCompany);
  const useCustom = compFees?.useCustomFees ?? false;

  // 1. Base shipping fee
  const baseShippingFee = Number(order.shippingFee) > 0 
    ? Number(order.shippingFee) 
    : Math.max(0, getStandardShippingFee(order, settings));

  // 2. Insurance fee
  const insuranceRate = useCustom 
    ? (compFees?.insuranceFeePercent ?? 0) 
    : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
  const isInsured = order.isInsured ?? true;
  const calculatedInsurance = isInsured ? calculateInsuranceFee(order, insuranceRate, settings) : 0;
  const insuranceFee = (order.insuranceFee !== undefined && order.insuranceFee !== null && Number(order.insuranceFee) > 0)
    ? Number(order.insuranceFee)
    : calculatedInsurance;

  // 3. Inspection fee
  const inspectionCost = useCustom 
    ? (compFees?.inspectionFee ?? 0) 
    : (settings.enableInspection ? settings.inspectionFee : 0);
  const inspectionFee = (order.inspectionFee !== undefined && order.inspectionFee !== null && Number(order.inspectionFee) > 0)
    ? Number(order.inspectionFee)
    : (order.includeInspectionFee === false ? 0 : inspectionCost);

  // 4. VAT 14%
  const vatFee = (order.vatValue !== undefined && order.vatValue !== null && Number(order.vatValue) > 0 && !order.vatOnStandardShipping)
    ? Number(order.vatValue)
    : calculateBostaVat({ ...order, shippingFee: baseShippingFee }, insuranceFee, settings);

  // 5. COD Fee
  const codFee = isDelivered && order.status !== 'مدفوعة' ? calculateCodFee(order, settings) : 0;

  // Carrier Additional: insurance + vat + inspection
  const carrierAdditionalFees = Math.round((insuranceFee + vatFee + inspectionFee) * 100) / 100;
  const totalShippingAndCarrier = Math.round((baseShippingFee + carrierAdditionalFees + codFee) * 100) / 100;

  return {
    baseShippingFee,
    insuranceFee,
    inspectionFee,
    vatFee,
    codFee,
    carrierAdditionalFees,
    totalShippingAndCarrier
  };
}

/**
 * Filter orders strictly belonging to a specific merchant
 */
export function isOrderForMerchant(
  order: Order, 
  merchantIdOrName: string, 
  merchantObj?: { id: string; name: string }
): boolean {
  // Check if order has any valid merchant/supplier association
  const hasMerchant = Boolean(
    (order.merchantId && order.merchantId !== 'pending') || 
    (order.merchantName && order.merchantName.trim() !== '' && order.merchantName !== 'pending') ||
    (order as any).isAgencyOrder
  );

  // If no merchant/supplier association at all, it is a standard store retail order -> EXCLUDE from merchant transparency report
  if (!hasMerchant) return false;

  // If 'all' is selected, include all merchant/supplier/agency orders
  if (!merchantIdOrName || merchantIdOrName === 'all') return true;

  const normalizeStr = (s: string) => 
    (s || '')
      .trim()
      .toLowerCase()
      .replace(/^(sup_|m_|part_)/, '')
      .replace(/أ|إ|آ/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/\s+/g, '');

  const target = normalizeStr(merchantIdOrName);
  const oMId = normalizeStr(order.merchantId || '');
  const oMName = normalizeStr(order.merchantName || '');

  if (target && oMId && (oMId === target || oMId.includes(target) || target.includes(oMId))) return true;
  if (target && oMName && (oMName === target || oMName.includes(target) || target.includes(oMName))) return true;

  if (merchantObj) {
    const objId = normalizeStr(merchantObj.id);
    const objName = normalizeStr(merchantObj.name);
    if (objId && oMId && (oMId === objId || oMId.includes(objId) || objId.includes(oMId))) return true;
    if (objName && oMName && (oMName === objName || oMName.includes(objName) || objName.includes(oMName))) return true;
    if (objName && oMId && (oMId === objName || oMId.includes(objName) || objName.includes(oMId))) return true;
    if (objId && oMName && (oMName === objId || oMName.includes(objId) || objId.includes(oMName))) return true;
  }

  return false;
}

/**
 * Main Pure Analytics Engine for Merchant Transparency
 */
export function calculateMerchantTransparencyAnalytics(
  allOrders: Order[],
  settings: Settings,
  merchantIdOrName: string,
  options: TransparencyFilterOptions = {},
  merchantObj?: { id: string; name: string }
): TransparencyAnalyticsResult {
  const {
    dateRange = 'all',
    startDate,
    endDate,
    settlementStatus = 'all',
    searchTerm = ''
  } = options;

  // 1. Filter by Merchant
  let filtered = allOrders.filter(o => isOrderForMerchant(o, merchantIdOrName, merchantObj));

  // 2. Filter by Date Range
  const now = new Date();
  if (dateRange === 'today') {
    const todayStr = now.toISOString().split('T')[0];
    filtered = filtered.filter(o => (o.date || '').startsWith(todayStr));
  } else if (dateRange === '7days') {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    filtered = filtered.filter(o => new Date(o.date) >= sevenDaysAgo);
  } else if (dateRange === 'month') {
    const currentYearMonth = now.toISOString().slice(0, 7); // YYYY-MM
    filtered = filtered.filter(o => (o.date || '').startsWith(currentYearMonth));
  } else if (dateRange === 'custom' && (startDate || endDate)) {
    if (startDate) {
      filtered = filtered.filter(o => (o.date || '').slice(0, 10) >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(o => (o.date || '').slice(0, 10) <= endDate);
    }
  }

  // 3. Filter by Settlement Status
  if (settlementStatus === 'settled') {
    filtered = filtered.filter(o => o.settlementStatus === 'settled' || !!o.settlementId);
  } else if (settlementStatus === 'unsettled') {
    filtered = filtered.filter(o => o.settlementStatus !== 'settled' && !o.settlementId);
  }

  // 4. Filter by Search Term if present
  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.trim().toLowerCase();
    filtered = filtered.filter(o => {
      const numMatch = (o.orderNumber || '').toLowerCase().includes(term);
      const custMatch = (o.customerName || '').toLowerCase().includes(term);
      const phoneMatch = (o.customerPhone || '').includes(term);
      const itemMatch = (o.items || []).some(i => (i.name || i.productName || '').toLowerCase().includes(term));
      return numMatch || custMatch || phoneMatch || itemMatch;
    });
  }

  // Aggregate order rows
  const orderRows: TransparencyOrderRow[] = [];
  const productMovementMap = new Map<string, ProductMovementItem>();

  let totalCollected = 0;
  let totalGoodsCostRecovered = 0;
  let totalBaseShipping = 0;
  let totalInsurance = 0;
  let totalInspection = 0;
  let totalVat = 0;
  let totalCodFees = 0;
  let totalCarrierAdditionalFees = 0;
  let totalShippingAndCarrier = 0;
  let totalServiceFees = 0;
  let totalMarketingCosts = 0;
  let totalReturnLosses = 0;
  let totalAllDeductions = 0;
  let netPayoutToMerchant = 0;

  let deliveredCount = 0;
  let returnCount = 0;
  let pendingDeliveryCount = 0;

  filtered.forEach(o => {
    const isDelivered = TRANSPARENCY_DELIVERED_STATUSES.includes(o.status);
    const isReturn = TRANSPARENCY_RETURN_STATUSES.includes(o.status);

    if (isDelivered) deliveredCount++;
    else if (isReturn) returnCount++;
    else pendingDeliveryCount++;

    const carrierCalc = computeOrderCarrierBreakdown(o, settings);

    // Revenue / Collection
    const collected = isDelivered 
      ? (o.totalAmountOverride !== undefined && o.totalAmountOverride !== null && Number(o.totalAmountOverride) > 0
          ? Number(o.totalAmountOverride)
          : (Number(o.totalPrice) || 0))
      : 0;

    // Goods Cost
    const defaultGoodsCost = o.merchantItemCost !== undefined && o.merchantItemCost > 0
      ? o.merchantItemCost
      : (o.items || []).reduce((sum, item) => sum + ((item.cost || 0) * (item.quantity || 1)), 0);

    // Marketing & Service
    const marketingFee = Number(o.marketingFeePerOrder) || 0;
    const defaultService = (settings as any).defaultMerchantServiceFee ?? 0;
    const serviceFee = isDelivered ? (o.serviceFeePerOrder !== undefined ? o.serviceFeePerOrder : defaultService) : 0;

    // Return loss
    const returnLoss = isReturn ? (carrierCalc.totalShippingAndCarrier + marketingFee) : 0;

    // Net for merchant from order
    let netMerchantAmount = 0;
    let merchantProfitOrLoss = 0;

    if (o.merchantSettlementMode === 'profit_share') {
      const ratio = (o.merchantProfitSharePercent || 50) / 100;
      const expenses = carrierCalc.totalShippingAndCarrier + marketingFee;
      const netMargin = collected - (isDelivered ? defaultGoodsCost : 0) - expenses;
      const merchantShare = netMargin * ratio;
      netMerchantAmount = (isDelivered ? defaultGoodsCost : 0) + merchantShare;
      merchantProfitOrLoss = isDelivered ? merchantShare : (-returnLoss);
    } else if (o.merchantSettlementMode === 'wholesale') {
      // Wholesale Mode: Merchant gets their goods cost only, minus deductions
      const deductions = serviceFee + carrierCalc.totalShippingAndCarrier + marketingFee;
      netMerchantAmount = isDelivered ? (defaultGoodsCost - deductions) : (-deductions);
      merchantProfitOrLoss = isDelivered ? (netMerchantAmount - defaultGoodsCost) : (-returnLoss);
    } else {
      // Fixed fee / Standard Commission / Dropshipping
      const deductions = serviceFee + carrierCalc.totalShippingAndCarrier + marketingFee;
      netMerchantAmount = isDelivered ? (collected - deductions) : (-deductions);
      merchantProfitOrLoss = isDelivered ? (netMerchantAmount - defaultGoodsCost) : (-returnLoss);
    }

    // Accumulate aggregates
    totalCollected += collected;
    if (isDelivered) {
      totalGoodsCostRecovered += defaultGoodsCost;
      totalServiceFees += serviceFee;
    }
    totalBaseShipping += carrierCalc.baseShippingFee;
    totalInsurance += carrierCalc.insuranceFee;
    totalInspection += carrierCalc.inspectionFee;
    totalVat += carrierCalc.vatFee;
    totalCodFees += carrierCalc.codFee;
    totalCarrierAdditionalFees += carrierCalc.carrierAdditionalFees;
    totalShippingAndCarrier += carrierCalc.totalShippingAndCarrier;
    totalMarketingCosts += marketingFee;
    if (isReturn) {
      totalReturnLosses += returnLoss;
    }
    netPayoutToMerchant += netMerchantAmount;

    // Items Summary
    const itemsSummary = (o.items || []).map(i => `${i.name || i.productName || 'منتج'} (x${i.quantity || 1})`).join('، ');

    orderRows.push({
      orderId: o.id,
      orderNumber: o.orderNumber || o.id,
      date: o.date,
      customerName: o.customerName || 'عميل',
      customerPhone: o.customerPhone,
      city: o.city || o.customerCity || o.governorate,
      shippingCompany: o.shippingCompany,
      status: o.status,
      isDelivered,
      isReturn,
      itemsSummary,
      itemsCount: (o.items || []).reduce((s, i) => s + (i.quantity || 1), 0),
      rawItems: o.items || [],
      collectedAmount: Math.round(collected * 100) / 100,
      merchantGoodsCost: Math.round(defaultGoodsCost * 100) / 100,
      baseShippingFee: Math.round(carrierCalc.baseShippingFee * 100) / 100,
      insuranceFee: Math.round(carrierCalc.insuranceFee * 100) / 100,
      inspectionFee: Math.round(carrierCalc.inspectionFee * 100) / 100,
      vatFee: Math.round(carrierCalc.vatFee * 100) / 100,
      codFee: Math.round(carrierCalc.codFee * 100) / 100,
      carrierAdditionalFees: Math.round(carrierCalc.carrierAdditionalFees * 100) / 100,
      totalShippingAndCarrier: Math.round(carrierCalc.totalShippingAndCarrier * 100) / 100,
      serviceFee: Math.round(serviceFee * 100) / 100,
      marketingFee: Math.round(marketingFee * 100) / 100,
      returnLoss: Math.round(returnLoss * 100) / 100,
      netMerchantAmount: Math.round(netMerchantAmount * 100) / 100,
      merchantProfitOrLoss: Math.round(merchantProfitOrLoss * 100) / 100,
      settlementStatus: o.settlementStatus,
      settlementId: o.settlementId,
      rawOrder: o
    });

    // Product movements tracking
    const orderItems = o.items && o.items.length > 0 ? o.items : [{
      productId: 'general',
      name: o.productName || 'منتج عام',
      quantity: 1,
      price: o.productPrice || 0,
      cost: o.merchantItemCost || o.productCost || 0,
      weight: o.weight || 0
    }];

    const totalOrderQty = orderItems.reduce((acc, it) => acc + (it.quantity || 1), 0) || 1;

    orderItems.forEach(item => {
      const key = item.productId || item.name || 'unknown';
      const existing = productMovementMap.get(key) || {
        productId: item.productId || 'p_unknown',
        sku: (item as any).sku || item.productId || '-',
        name: item.name || (item as any).productName || 'منتج',
        image: item.thumbnail || item.image,
        totalQuantityOrdered: 0,
        quantityDelivered: 0,
        totalDeliveredSales: 0,
        totalDeliveredCost: 0,
        quantityReturned: 0,
        returnRate: 0,
        allocatedExpenses: 0,
        netProfit: 0
      };

      const itemQty = item.quantity || 1;
      const itemPrice = item.price || 0;
      const itemCost = item.cost || 0;
      const proportion = itemQty / totalOrderQty;

      existing.totalQuantityOrdered += itemQty;

      if (isDelivered) {
        const itemCollected = collected * proportion;
        existing.quantityDelivered += itemQty;
        existing.totalDeliveredSales += itemCollected;
        existing.totalDeliveredCost += (itemCost * itemQty);
        
        // Distribute order expenses proportionally
        const orderExp = carrierCalc.totalShippingAndCarrier + serviceFee + marketingFee;
        const itemAllocatedExp = orderExp * proportion;
        existing.allocatedExpenses += Math.round(itemAllocatedExp * 100) / 100;
        
        // Net profit = (itemCollected - itemAllocatedExp) - itemCost
        const itemNetProfit = itemCollected - itemAllocatedExp - (itemCost * itemQty);
        existing.netProfit += Math.round(itemNetProfit * 100) / 100;
      } else if (isReturn) {
        existing.quantityReturned += itemQty;
        const returnExp = returnLoss * proportion;
        existing.allocatedExpenses += Math.round(returnExp * 100) / 100;
        existing.netProfit -= Math.round(returnExp * 100) / 100;
      }

      productMovementMap.set(key, existing);
    });
  });

  // Calculate return rates on products
  const productMovements = Array.from(productMovementMap.values()).map(p => {
    const totalFinished = p.quantityDelivered + p.quantityReturned;
    const rate = totalFinished > 0 ? Math.round((p.quantityReturned / totalFinished) * 1000) / 10 : 0;
    return {
      ...p,
      returnRate: rate,
      totalDeliveredSales: Math.round(p.totalDeliveredSales * 100) / 100,
      totalDeliveredCost: Math.round(p.totalDeliveredCost * 100) / 100,
      allocatedExpenses: Math.round(p.allocatedExpenses * 100) / 100,
      netProfit: Math.round(p.netProfit * 100) / 100
    };
  }).sort((a, b) => b.totalDeliveredSales - a.totalDeliveredSales);

  totalAllDeductions = totalShippingAndCarrier + totalServiceFees + totalMarketingCosts;
  const merchantNetProfitOrLoss = Math.round((netPayoutToMerchant - totalGoodsCostRecovered) * 100) / 100;
  const roiPercentage = totalGoodsCostRecovered > 0 
    ? Math.round((merchantNetProfitOrLoss / totalGoodsCostRecovered) * 1000) / 10 
    : 0;

  const totalClosed = deliveredCount + returnCount;
  const deliverySuccessRate = totalClosed > 0 ? Math.round((deliveredCount / totalClosed) * 1000) / 10 : 0;
  const returnRate = totalClosed > 0 ? Math.round((returnCount / totalClosed) * 1000) / 10 : 0;

  let dateRangeLabel = 'كل الفترات';
  if (dateRange === 'today') dateRangeLabel = 'اليوم';
  else if (dateRange === '7days') dateRangeLabel = 'آخر 7 أيام';
  else if (dateRange === 'month') dateRangeLabel = 'هذا الشهر';
  else if (dateRange === 'custom') dateRangeLabel = `${startDate || 'البداية'} إلى ${endDate || 'الآن'}`;

  const merchantDisplayName = merchantObj?.name || merchantIdOrName || 'كافة الموكلين';

  return {
    merchantIdentifier: merchantIdOrName,
    merchantDisplayName,
    dateRangeLabel,
    totalOrdersCount: filtered.length,
    deliveredCount,
    returnCount,
    pendingDeliveryCount,
    deliverySuccessRate,
    returnRate,
    totalCollected: Math.round(totalCollected * 100) / 100,
    totalGoodsCostRecovered: Math.round(totalGoodsCostRecovered * 100) / 100,
    totalBaseShipping: Math.round(totalBaseShipping * 100) / 100,
    totalCarrierAdditionalFees: Math.round(totalCarrierAdditionalFees * 100) / 100,
    totalInsurance: Math.round(totalInsurance * 100) / 100,
    totalInspection: Math.round(totalInspection * 100) / 100,
    totalVat: Math.round(totalVat * 100) / 100,
    totalCodFees: Math.round(totalCodFees * 100) / 100,
    totalShippingAndCarrier: Math.round(totalShippingAndCarrier * 100) / 100,
    totalServiceFees: Math.round(totalServiceFees * 100) / 100,
    totalMarketingCosts: Math.round(totalMarketingCosts * 100) / 100,
    totalReturnLosses: Math.round(totalReturnLosses * 100) / 100,
    totalAllDeductions: Math.round(totalAllDeductions * 100) / 100,
    netPayoutToMerchant: Math.round(netPayoutToMerchant * 100) / 100,
    merchantNetProfitOrLoss,
    roiPercentage,
    productMovements,
    orderRows
  };
}

/**
 * Export Multi-sheet Excel Transparency Workbook
 */
export function exportMerchantTransparencyExcel(
  analytics: TransparencyAnalyticsResult,
  storeName: string = 'المتجر'
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: كشف ميزان الشفافية والملخص المالي
  const summaryData = [
    { 'البند': 'تقرير الشفافية والمساءلة المالية للموكل', 'القيمة': '' },
    { 'البند': 'اسم الموكل / صاحب البضاعة', 'القيمة': analytics.merchantDisplayName },
    { 'البند': 'الفترة الزمنية', 'القيمة': analytics.dateRangeLabel },
    { 'البند': 'تاريخ استخراج التقرير', 'القيمة': new Date().toLocaleDateString('ar-EG') },
    { 'البند': '', 'القيمة': '' },
    { 'البند': '--- حركة الشحنات والطلبات ---', 'القيمة': '' },
    { 'البند': 'إجمالي عدد الطلبات', 'القيمة': analytics.totalOrdersCount },
    { 'البند': 'عدد الطلبات المسلمة والناجحة', 'القيمة': analytics.deliveredCount },
    { 'البند': 'عدد الطلبات المرتجعة والفاشلة', 'القيمة': analytics.returnCount },
    { 'البند': 'طلبات قيد التوصيل والمتابعة', 'القيمة': analytics.pendingDeliveryCount },
    { 'البند': 'نسبة نجاح التسليم (%)', 'القيمة': `${analytics.deliverySuccessRate}%` },
    { 'البند': 'نسبة الارتجاع (%)', 'القيمة': `${analytics.returnRate}%` },
    { 'البند': '', 'القيمة': '' },
    { 'البند': '--- الميزان المالي والتحصيل ---', 'القيمة': '' },
    { 'البند': 'إجمالي النقدية المحصلة من العملاء', 'القيمة': analytics.totalCollected },
    { 'البند': 'استرداد رأس مال البضاعة المباعة (حق الموكل في التكلفة)', 'القيمة': analytics.totalGoodsCostRecovered },
    { 'البند': 'مصاريف الشحن الأساسية لشركات الشحن', 'القيمة': analytics.totalBaseShipping },
    { 'البند': 'رسوم التأمين على الشحنات', 'القيمة': analytics.totalInsurance },
    { 'البند': 'رسوم المعاينة وفتح الطرد', 'القيمة': analytics.totalInspection },
    { 'البند': 'ضريبة القيمة المضافة 14% (VAT)', 'القيمة': analytics.totalVat },
    { 'البند': 'عمولات التحصيل النقدي COD لشركة الشحن', 'القيمة': analytics.totalCodFees },
    { 'البند': 'إجمالي لوجستيات الشحن والرسوم الإضافية', 'القيمة': analytics.totalShippingAndCarrier },
    { 'البند': 'عمولة التشغيل والخدمة لمقدم الخدمة', 'القيمة': analytics.totalServiceFees },
    { 'البند': 'مصاريف الإعلانات والتسويق', 'القيمة': analytics.totalMarketingCosts },
    { 'البند': 'إجمالي خسائر المرتجعات المخصومة', 'القيمة': analytics.totalReturnLosses },
    { 'البند': 'إجمالي المصاريف والاستقطاعات', 'القيمة': analytics.totalAllDeductions },
    { 'البند': '', 'القيمة': '' },
    { 'البند': '--- الموقف المالي النهائي ---', 'القيمة': '' },
    { 'البند': 'صافي أرباح / خسائر الموكل فوق رأس المال', 'القيمة': analytics.merchantNetProfitOrLoss },
    { 'البند': 'معدل العائد على الاستثمار للموكل (%)', 'القيمة': `${analytics.roiPercentage}%` },
    { 'البند': 'الصافي النهائي الواجب تحويله لحساب الموكل', 'القيمة': analytics.netPayoutToMerchant }
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'الميزان والملخص المالي');

  // Sheet 2: حركة المنتجات المباعة والمرتجعة
  const productData = analytics.productMovements.map(p => ({
    'كود الصنف SKU': p.sku,
    'اسم المنتج': p.name,
    'إجمالي الكمية المطلوبة': p.totalQuantityOrdered,
    'الكمية المباعة (المسلمة)': p.quantityDelivered,
    'إجمالي مبيعات الصنف (ج.م)': p.totalDeliveredSales,
    'تكلفة رأس مال المباع (ج.م)': p.totalDeliveredCost,
    'الكمية المرتجعة': p.quantityReturned,
    'نسبة الارتجاع (%)': `${p.returnRate}%`,
    'المصروفات المحملة على الصنف (ج.م)': p.allocatedExpenses,
    'صافي ربح الصنف للموكل (ج.م)': p.netProfit
  }));

  const wsProducts = XLSX.utils.json_to_sheet(productData);
  XLSX.utils.book_append_sheet(wb, wsProducts, 'حركة المنتجات المباعة والمرتجعة');

  // Sheet 3: البيان التفصيلي للأوردرات
  const ordersData = analytics.orderRows.map(o => ({
    'رقم الطلب': o.orderNumber,
    'التاريخ': new Date(o.date).toLocaleDateString('ar-EG'),
    'اسم العميل': o.customerName,
    'رقم الهاتف': o.customerPhone || '',
    'المدينة / المحافظة': o.city || '',
    'شركة الشحن': o.shippingCompany || '',
    'الحالة': o.status,
    'المنتجات والكميات': o.itemsSummary,
    'المبلغ المحصل (ج.م)': o.collectedAmount,
    'تكلفة بضاعة الطلب (ج.م)': o.merchantGoodsCost,
    'مصاريف الشحن الأساسي': o.baseShippingFee,
    'رسوم التأمين': o.insuranceFee,
    'رسوم المعاينة': o.inspectionFee,
    'ضريبة VAT 14%': o.vatFee,
    'عمولة COD': o.codFee,
    'إجمالي الشحن والرسوم': o.totalShippingAndCarrier,
    'عمولة التشغيل': o.serviceFee,
    'مصاريف التسويق': o.marketingFee,
    'خسارة المرتجع': o.returnLoss,
    'صافي مستحق الموكل (ج.م)': o.netMerchantAmount,
    'ربح/خسارة الموكل من الطلب': o.merchantProfitOrLoss,
    'حالة التسوية': o.settlementStatus === 'settled' ? 'تمت التسوية' : 'غير مسوى'
  }));

  const wsOrders = XLSX.utils.json_to_sheet(ordersData);
  XLSX.utils.book_append_sheet(wb, wsOrders, 'البيان التفصيلي للأوردرات');

  const fileName = `تقرير_شفافية_الموكل_${analytics.merchantDisplayName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Generate Printable Official A4 Transparency Report HTML
 */
export function printMerchantTransparencyReport(
  analytics: TransparencyAnalyticsResult,
  storeName: string = 'المتجر الإلكتروني'
) {
  const isProfit = analytics.merchantNetProfitOrLoss >= 0;
  const printHtml = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>تقرير الشفافية ومحاسبة الموكل - ${analytics.merchantDisplayName}</title>
      <style>
        @page { size: A4; margin: 12mm 10mm; }
        * { box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
          color: #0f172a;
          background: #ffffff;
          margin: 0;
          padding: 10px;
          font-size: 11px;
          line-height: 1.4;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .header h1 {
          margin: 0 0 4px 0;
          font-size: 18px;
          color: #0f172a;
          font-weight: 800;
        }
        .header .subtitle {
          color: #475569;
          font-size: 11px;
          font-weight: 500;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 14px;
          margin-bottom: 16px;
        }
        .meta-item .label {
          color: #64748b;
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .meta-item .val {
          color: #0f172a;
          font-size: 12px;
          font-weight: 700;
          margin-top: 2px;
        }
        .kpi-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 16px;
        }
        .kpi-card {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 10px;
          text-align: center;
          background: #ffffff;
        }
        .kpi-card.highlight {
          background: #f0fdf4;
          border-color: #86efac;
        }
        .kpi-card.highlight-profit {
          background: #ecfdf5;
          border-color: #10b981;
        }
        .kpi-card .kpi-label {
          font-size: 10px;
          color: #475569;
          font-weight: 600;
        }
        .kpi-card .kpi-val {
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
          margin-top: 4px;
          font-family: monospace;
        }
        .section-title {
          font-size: 13px;
          font-weight: 800;
          color: #1e293b;
          border-bottom: 1.5px solid #e2e8f0;
          padding-bottom: 6px;
          margin: 16px 0 10px 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 14px;
          font-size: 10px;
        }
        th {
          background: #f1f5f9;
          color: #334155;
          font-weight: 700;
          text-align: right;
          padding: 6px 8px;
          border: 1px solid #cbd5e1;
          white-space: nowrap;
        }
        td {
          padding: 6px 8px;
          border: 1px solid #e2e8f0;
          color: #1e293b;
        }
        tr:nth-child(even) td {
          background: #f8fafc;
        }
        .badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 700;
        }
        .badge-delivered { background: #dcfce7; color: #166534; }
        .badge-return { background: #fee2e2; color: #991b1b; }
        .num { font-family: monospace; direction: ltr; display: inline-block; }
        .summary-banner {
          background: #0f172a;
          color: #ffffff;
          padding: 14px 18px;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 20px;
          page-break-inside: avoid;
        }
        .summary-banner .title {
          font-size: 13px;
          font-weight: 700;
        }
        .summary-banner .formula {
          font-size: 10px;
          color: #94a3b8;
          margin-top: 3px;
        }
        .summary-banner .amount {
          font-size: 22px;
          font-weight: 900;
          color: #34d399;
          font-family: monospace;
        }
        .footer-note {
          margin-top: 14px;
          font-size: 9px;
          color: #64748b;
          text-align: center;
          border-top: 1px dashed #cbd5e1;
          padding-top: 8px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>كشف الشفافية وحركة البضاعة للموكل</h1>
          <div class="subtitle">${storeName} • تقرير الشفافية والمساءلة المالية التفاعلية</div>
        </div>
        <div style="text-align: left;">
          <div style="font-weight: 800; font-size: 13px; color: #0f172a;">${analytics.merchantDisplayName}</div>
          <div style="font-size: 10px; color: #64748b;">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</div>
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta-item">
          <div class="label">الموكل / الشريك</div>
          <div class="val">${analytics.merchantDisplayName}</div>
        </div>
        <div class="meta-item">
          <div class="label">الفترة المشمولة</div>
          <div class="val">${analytics.dateRangeLabel}</div>
        </div>
        <div class="meta-item">
          <div class="label">إجمالي الطلبات المسجلة</div>
          <div class="val">${analytics.totalOrdersCount} طلب (${analytics.deliveredCount} مسلّم • ${analytics.returnCount} مرتجع)</div>
        </div>
        <div class="meta-item">
          <div class="label">معدل التسليم والارتجاع</div>
          <div class="val">تسليم ${analytics.deliverySuccessRate}% • ارتجاع ${analytics.returnRate}%</div>
        </div>
      </div>

      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-label">إجمالي المحصل من العملاء</div>
          <div class="kpi-val">${analytics.totalCollected.toLocaleString()} ج.م</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">استرداد رأس مال البضاعة</div>
          <div class="kpi-val" style="color: #0284c7;">${analytics.totalGoodsCostRecovered.toLocaleString()} ج.م</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">إجمالي الشحن والرسوم</div>
          <div class="kpi-val" style="color: #dc2626;">-${analytics.totalShippingAndCarrier.toLocaleString()} ج.م</div>
        </div>
        <div class="kpi-card highlight-profit">
          <div class="kpi-label">صافي ربح الموكل فوق رأس المال</div>
          <div class="kpi-val" style="color: ${isProfit ? '#059669' : '#dc2626'};">
            ${isProfit ? '+' : ''}${analytics.merchantNetProfitOrLoss.toLocaleString()} ج.م
          </div>
        </div>
      </div>

      <!-- Section: حركة وتجميع المنتجات المباعة والمرتجعة -->
      <div class="section-title">
        <span>أولاً: بيان حركة المنتجات المباعة والمرتجعة (Product Movement Breakdown)</span>
        <span style="font-size: 10px; font-weight: normal; color: #64748b;">${analytics.productMovements.length} أصناف</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>كود SKU</th>
            <th>اسم المنتج</th>
            <th>المطلوب</th>
            <th>المسلّم</th>
            <th>المرتجع</th>
            <th>نسبة الارتجاع</th>
            <th>مبيعات الصنف</th>
            <th>تكلفة رأس المال</th>
            <th>المصروفات المحملة</th>
            <th>صافي ربح الصنف</th>
          </tr>
        </thead>
        <tbody>
          ${analytics.productMovements.map(p => `
            <tr>
              <td class="num">${p.sku}</td>
              <td style="font-weight: 700;">${p.name}</td>
              <td class="num">${p.totalQuantityOrdered}</td>
              <td class="num" style="color: #166534; font-weight: 700;">${p.quantityDelivered}</td>
              <td class="num" style="color: #991b1b; font-weight: 700;">${p.quantityReturned}</td>
              <td class="num" style="color: ${p.returnRate > 20 ? '#dc2626' : '#475569'};">${p.returnRate}%</td>
              <td class="num">${p.totalDeliveredSales.toLocaleString()} ج.م</td>
              <td class="num">${p.totalDeliveredCost.toLocaleString()} ج.م</td>
              <td class="num" style="color: #dc2626;">-${p.allocatedExpenses.toLocaleString()} ج.م</td>
              <td class="num" style="font-weight: 700; color: ${p.netProfit >= 0 ? '#166534' : '#991b1b'};">
                ${p.netProfit >= 0 ? '+' : ''}${p.netProfit.toLocaleString()} ج.م
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Section: تفاصيل الأوردرات -->
      <div class="section-title">
        <span>ثانياً: البيان المحاسبي التفصيلي للطلبات (Itemized Order Ledger)</span>
        <span style="font-size: 10px; font-weight: normal; color: #64748b;">${analytics.orderRows.length} طلبات</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>رقم الطلب</th>
            <th>التاريخ</th>
            <th>العميل</th>
            <th>الحالة</th>
            <th>التحصيل</th>
            <th>رأس المال</th>
            <th>الشحن والرسوم</th>
            <th>العمولة والتسويق</th>
            <th>الصافي للموكل</th>
          </tr>
        </thead>
        <tbody>
          ${analytics.orderRows.slice(0, 100).map(o => `
            <tr>
              <td class="num" style="font-weight: 700;">${o.orderNumber}</td>
              <td>${new Date(o.date).toLocaleDateString('ar-EG')}</td>
              <td>${o.customerName}</td>
              <td>
                <span class="badge ${o.isDelivered ? 'badge-delivered' : o.isReturn ? 'badge-return' : ''}">
                  ${o.status}
                </span>
              </td>
              <td class="num">${o.collectedAmount.toLocaleString()} ج.م</td>
              <td class="num">${o.merchantGoodsCost.toLocaleString()} ج.م</td>
              <td class="num" style="color: #dc2626;">-${o.totalShippingAndCarrier.toLocaleString()} ج.م</td>
              <td class="num" style="color: #475569;">-${(o.serviceFee + o.marketingFee).toLocaleString()} ج.م</td>
              <td class="num" style="font-weight: 800; color: ${o.netMerchantAmount >= 0 ? '#166534' : '#991b1b'};">
                ${o.netMerchantAmount.toLocaleString()} ج.م
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="summary-banner">
        <div>
          <div class="title">الصافي النهائي المستحق للتحويل للموكل</div>
          <div class="formula">
            المعادلة: رأس مال البضاعة المسترد (${analytics.totalGoodsCostRecovered.toLocaleString()} ج.م) 
            ${isProfit ? `+ صافي الربح (${analytics.merchantNetProfitOrLoss.toLocaleString()} ج.م)` : `- صافي الخسارة (${Math.abs(analytics.merchantNetProfitOrLoss).toLocaleString()} ج.م)`}
          </div>
        </div>
        <div class="amount">${analytics.netPayoutToMerchant.toLocaleString()} ج.م</div>
      </div>

      <div class="footer-note">
        تم استخراج هذا الكشف آلياً لضمان الشفافية والمساءلة والمطابقة الدورية بين الموكل وإدارة المتجر.
      </div>
    </body>
    </html>
  `;

  printHTMLDirectly(printHtml);
}

/**
 * Generate formatted WhatsApp message text
 */
export function buildWhatsAppTransparencyText(
  analytics: TransparencyAnalyticsResult,
  storeName: string = 'المتجر'
): string {
  const isProfit = analytics.merchantNetProfitOrLoss >= 0;
  
  let msg = `*تقرير الشفافية وحركة الحسابات المالية* 📊\n`;
  msg += `متجر: *${storeName}*\n`;
  msg += `الموكل / الشريك: *${analytics.merchantDisplayName}*\n`;
  msg += `الفترة: *${analytics.dateRangeLabel}*\n\n`;

  msg += `📦 *حركة الشحنات:*\n`;
  msg += `• إجمالي الطلبات: ${analytics.totalOrdersCount} طلب\n`;
  msg += `• الناجح والمسلّم: ${analytics.deliveredCount} طلب (بنسبة تسليم ${analytics.deliverySuccessRate}%)\n`;
  msg += `• المرتجع والفاشل: ${analytics.returnCount} طلب (بنسبة ارتجاع ${analytics.returnRate}%)\n\n`;

  msg += `💰 *الميزان المالي والتحصيل:*\n`;
  msg += `• إجمالي النقدية المحصلة: ${analytics.totalCollected.toLocaleString()} ج.م\n`;
  msg += `• استرداد رأس مال البضاعة المباعة: ${analytics.totalGoodsCostRecovered.toLocaleString()} ج.م\n`;
  msg += `• مصاريف الشحن واللوجستيات: -${analytics.totalShippingAndCarrier.toLocaleString()} ج.م\n`;
  msg += `  (شحن: ${analytics.totalBaseShipping} | تأمين: ${analytics.totalInsurance} | معاينة: ${analytics.totalInspection} | ضريبة 14%: ${analytics.totalVat})\n`;
  msg += `• عمولات التشغيل والتسويق: -${(analytics.totalServiceFees + analytics.totalMarketingCosts).toLocaleString()} ج.م\n`;
  if (analytics.totalReturnLosses > 0) {
    msg += `• خسائر شحن المرتجعات: -${analytics.totalReturnLosses.toLocaleString()} ج.م\n`;
  }
  msg += `\n`;

  msg += `📈 *الموقف المالي النهائي:*\n`;
  msg += `• صافي ربح البضاعة فوق رأس المال: ${isProfit ? '+' : ''}${analytics.merchantNetProfitOrLoss.toLocaleString()} ج.م\n`;
  msg += `• العائد على رأس المال (ROI): ${analytics.roiPercentage}%\n`;
  msg += `💵 *الصافي النهائي الواجب تحويله لحسابك: ${analytics.netPayoutToMerchant.toLocaleString()} ج.م*\n\n`;

  if (analytics.productMovements.length > 0) {
    msg += `🏷️ *ملخص حركة المنتجات:*\n`;
    analytics.productMovements.slice(0, 5).forEach((p, idx) => {
      msg += `${idx + 1}. *${p.name}* (SKU: ${p.sku}):\n`;
      msg += `   بيع: ${p.quantityDelivered} ق | ارتجع: ${p.quantityReturned} ق | صافي ربحه: ${p.netProfit.toLocaleString()} ج.م\n`;
    });
    if (analytics.productMovements.length > 5) {
      msg += `   ... وغيرها ${analytics.productMovements.length - 5} أصناف في الكشف المرفق.\n`;
    }
  }

  msg += `\nكشف تفصيلي شفاف تم إنشاؤه لضمان أعلى درجات الثقة والمصداقية 🤝`;
  return msg;
}
