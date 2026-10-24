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
  'تم_الاستبدال'
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
 * Synchronized strictly with financials.ts (calculateOrderProfitLoss & calculateOrderShippingAndFees)
 */
export function computeOrderCarrierBreakdown(order: Order, settings: Settings) {
  const isPos = order.channel === 'pos' || 
                order.shippingCompany === 'كاشير - بيع مباشر' || 
                order.shippingArea === 'نقطة البيع' ||
                (order.id && order.id.startsWith('POS-'));

  if (isPos) {
    return {
      baseShippingFee: 0,
      insuranceFee: 0,
      inspectionFee: 0,
      vatFee: 0,
      codFee: 0,
      carrierAdditionalFees: 0,
      totalShippingAndCarrier: 0
    };
  }

  const isDelivered = TRANSPARENCY_DELIVERED_STATUSES.includes(order.status);
  const compFees = getCompanySpecificFees(settings, order.shippingCompany);
  const useCustom = compFees?.useCustomFees ?? false;

  // 1. Base shipping fee
  const manualShippingFee = (order.isManualShippingOverride && order.shippingFee !== undefined) ? order.shippingFee : null;
  const baseShippingFee = manualShippingFee !== null 
    ? manualShippingFee 
    : (Number(order.shippingFee) > 0 ? Number(order.shippingFee) : getStandardShippingFee(order, settings));

  // 2. Insurance fee
  const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings?.enableInsurance ? settings.insuranceFeePercent : 0);
  const isInsured = order.isInsured ?? true;
  const calculatedInsurance = isInsured ? calculateInsuranceFee(order, insuranceRate, settings) : 0;
  const insuranceFee = Number((
    (order.insuranceFee !== undefined && order.insuranceFee !== null && Number(order.insuranceFee) > 0)
      ? Number(order.insuranceFee)
      : calculatedInsurance
  ).toFixed(2));

  // 3. Inspection fee
  const inspectionCost = useCustom ? (compFees?.inspectionFee ?? 0) : (settings?.enableInspection ? (settings.inspectionFee ?? 0) : 0);
  const inspectionFee = Number((
    (order.includeInspectionFee !== false)
      ? ((order.inspectionFee !== undefined && order.inspectionFee !== null && Number(order.inspectionFee) > 0)
          ? Number(order.inspectionFee)
          : inspectionCost)
      : 0
  ).toFixed(2));

  // 4. COD Fee
  const isExchange = order.status === 'تم_الاستبدال';
  const codFee = Number(((isDelivered || order.status === 'تم_الارسال' || order.status === 'قيد_الشحن') && order.status !== 'مدفوعة' && !isExchange ? calculateCodFee(order, settings) : 0).toFixed(2));

  // 5. VAT 14% (ضريبة القيمة المضافة)
  const vatFee = Number((
    (order.vatValue !== undefined && order.vatValue !== null && Number(order.vatValue) > 0 && !order.vatOnStandardShipping)
      ? Number(order.vatValue)
      : calculateBostaVat({ ...order, shippingFee: baseShippingFee }, insuranceFee, settings)
  ).toFixed(2));

  // Carrier Additional: insurance + vat + inspection
  const carrierAdditionalFees = Number((insuranceFee + vatFee + inspectionFee).toFixed(2));
  const totalShippingAndCarrier = Number((baseShippingFee + carrierAdditionalFees + codFee).toFixed(2));

  return {
    baseShippingFee: Number(baseShippingFee.toFixed(2)),
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
      const rawSku = String((item as any).sku || item.productId || '').trim();
      const formattedSku = !rawSku || rawSku === 'general' || rawSku === 'p_unknown' || rawSku === '-'
        ? '—'
        : (rawSku.startsWith('wuilt_prod_') || rawSku.length > 14)
          ? `SKU-${rawSku.replace(/^wuilt_prod_/i, '').split('_')[0].slice(-6).toUpperCase()}`
          : rawSku;
      const existing = productMovementMap.get(key) || {
        productId: item.productId || 'p_unknown',
        sku: formattedSku,
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
  const formatSku = (sku?: string) => {
    if (!sku || sku === '-') return '';
    if (sku.startsWith('imported-')) {
      const parts = sku.split('-');
      return `SKU-${parts[parts.length - 1] || sku.slice(-4)}`;
    }
    return sku.length > 18 ? sku.slice(0, 16) + '…' : sku;
  };

  const totalOrderedUnits = analytics.productMovements.reduce((s, p) => s + p.totalQuantityOrdered, 0);
  const totalDeliveredUnits = analytics.productMovements.reduce((s, p) => s + p.quantityDelivered, 0);
  const totalReturnedUnits = analytics.productMovements.reduce((s, p) => s + p.quantityReturned, 0);
  const totalSalesSum = analytics.productMovements.reduce((s, p) => s + p.totalDeliveredSales, 0);
  const totalCostSum = analytics.productMovements.reduce((s, p) => s + p.totalDeliveredCost, 0);
  const totalExpSum = analytics.productMovements.reduce((s, p) => s + p.allocatedExpenses, 0);
  const totalNetProfitSum = analytics.productMovements.reduce((s, p) => s + p.netProfit, 0);

  const printDate = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const printHtml = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>تقرير الشفافية ومحاسبة الموكل - ${analytics.merchantDisplayName}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@500;600;700;800;900&display=swap" rel="stylesheet">
      <style>
        @page { size: A4 portrait; margin: 10mm 10mm; }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
          color: #0f172a;
          background: #ffffff;
          margin: 0;
          padding: 8px;
          font-size: 11px;
          line-height: 1.45;
          direction: rtl;
        }
        .report-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: #ffffff;
          padding: 16px 20px;
          border-radius: 12px;
          border-bottom: 4px solid #10b981;
          margin-bottom: 14px;
        }
        .report-header h1 {
          margin: 0;
          font-size: 18px;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: -0.2px;
        }
        .report-header .subtitle {
          color: #94a3b8;
          font-size: 11px;
          font-weight: 600;
          margin-top: 3px;
        }
        .merchant-badge {
          text-align: left;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.16);
          padding: 8px 14px;
          border-radius: 10px;
        }
        .merchant-badge .m-name {
          font-weight: 900;
          font-size: 14px;
          color: #34d399;
        }
        .merchant-badge .m-date {
          font-size: 10px;
          color: #cbd5e1;
          margin-top: 2px;
        }
        .meta-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 10px 14px;
          margin-bottom: 14px;
        }
        .meta-item .label {
          color: #64748b;
          font-size: 9.5px;
          font-weight: 700;
        }
        .meta-item .val {
          color: #0f172a;
          font-size: 11.5px;
          font-weight: 800;
          margin-top: 2px;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 8px;
          margin-bottom: 16px;
        }
        .kpi-box {
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 9px 8px;
          text-align: center;
          background: #ffffff;
        }
        .kpi-box.capital { background: #f0f9ff; border-color: #bae6fd; }
        .kpi-box.deduction { background: #fff1f2; border-color: #fecdd3; }
        .kpi-box.profit { background: ${isProfit ? '#ecfdf5' : '#fef2f2'}; border-color: ${isProfit ? '#6ee7b7' : '#fca5a5'}; }
        .kpi-box.net-final { background: #0f172a; border-color: #0f172a; color: #ffffff; }
        .kpi-box .k-lbl {
          font-size: 9.5px;
          font-weight: 700;
          color: #475569;
        }
        .kpi-box.net-final .k-lbl { color: #94a3b8; }
        .kpi-box .k-val {
          font-size: 13.5px;
          font-weight: 900;
          margin-top: 3px;
          font-variant-numeric: tabular-nums;
          direction: ltr;
        }
        .section-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f1f5f9;
          border-right: 4px solid #0f172a;
          padding: 7px 12px;
          border-radius: 6px;
          margin: 14px 0 8px 0;
        }
        .section-bar .sec-title {
          font-size: 12.5px;
          font-weight: 900;
          color: #0f172a;
        }
        .section-bar .sec-count {
          font-size: 10px;
          font-weight: 700;
          color: #475569;
          background: #ffffff;
          padding: 2px 8px;
          border-radius: 99px;
          border: 1px solid #cbd5e1;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          margin-bottom: 14px;
          font-size: 10px;
          background: #ffffff;
        }
        thead {
          display: table-header-group;
        }
        tfoot {
          display: table-footer-group;
        }
        tr {
          display: table-row !important;
          page-break-inside: avoid;
        }
        th, td {
          display: table-cell !important;
          vertical-align: middle;
          padding: 6px 6px;
          border: 1px solid #cbd5e1;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        th {
          background: #0f172a;
          color: #ffffff;
          font-weight: 800;
          text-align: center;
          font-size: 9.5px;
        }
        th.text-right, td.text-right {
          text-align: right;
        }
        td {
          text-align: center;
          color: #1e293b;
          font-weight: 600;
        }
        tbody tr:nth-child(even) td {
          background: #f8fafc;
        }
        tfoot td {
          background: #f1f5f9 !important;
          font-weight: 900;
          color: #0f172a;
          border-top: 2px solid #0f172a;
          font-size: 10.5px;
        }
        .num-cell {
          font-variant-numeric: tabular-nums;
          font-weight: 700;
          text-align: center;
        }
        .ltr-val {
          direction: ltr;
          unicode-bidi: embed;
        }
        .sku-sub {
          display: block;
          font-size: 8.5px;
          color: #64748b;
          font-family: monospace;
          margin-top: 1px;
        }
        .badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 800;
          white-space: nowrap;
        }
        .badge-delivered { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
        .badge-return { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
        .badge-pending { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
        .summary-banner {
          background: #0f172a;
          color: #ffffff;
          padding: 14px 18px;
          border-radius: 10px;
          border: 2px solid #10b981;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 14px;
          page-break-inside: avoid;
        }
        .summary-banner .title {
          font-size: 13.5px;
          font-weight: 900;
          color: #ffffff;
        }
        .summary-banner .formula {
          font-size: 10px;
          color: #cbd5e1;
          margin-top: 3px;
          font-weight: 600;
        }
        .summary-banner .amount {
          font-size: 20px;
          font-weight: 900;
          color: #34d399;
          direction: ltr;
        }
        .signatures-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-top: 18px;
          padding-top: 12px;
          border-top: 1px dashed #cbd5e1;
          page-break-inside: avoid;
          text-align: center;
          font-size: 10px;
          color: #475569;
          font-weight: 700;
        }
        .sig-line {
          margin-top: 22px;
          border-bottom: 1px solid #94a3b8;
          width: 75%;
          margin-left: auto;
          margin-right: auto;
        }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div class="report-header">
        <div>
          <h1>كشف الشفافية وحركة البضاعة والحساب المالي للموكل</h1>
          <div class="subtitle">${storeName} • بيان محاسبي تفصيلي معتمد لحركة المبيعات والمرتجعات وصافي المستحقات</div>
        </div>
        <div class="merchant-badge">
          <div class="m-name">${analytics.merchantDisplayName}</div>
          <div class="m-date">تاريخ الإصدار: ${printDate}</div>
        </div>
      </div>

      <!-- Meta Info Strip -->
      <div class="meta-strip">
        <div class="meta-item">
          <div class="label">اسم الموكل / الشريك</div>
          <div class="val">${analytics.merchantDisplayName}</div>
        </div>
        <div class="meta-item">
          <div class="label">الفترة المشمولة بالتقرير</div>
          <div class="val">${analytics.dateRangeLabel}</div>
        </div>
        <div class="meta-item">
          <div class="label">إجمالي الشحنات المسجلة</div>
          <div class="val">${analytics.totalOrdersCount} طلب (${analytics.deliveredCount} مسلّم • ${analytics.returnCount} مرتجع)</div>
        </div>
        <div class="meta-item">
          <div class="label">مؤشر التسليم والارتجاع</div>
          <div class="val">تسليم ${analytics.deliverySuccessRate}% • ارتجاع ${analytics.returnRate}%</div>
        </div>
      </div>

      <!-- 6 Executive Financial KPIs -->
      <div class="kpi-grid">
        <div class="kpi-box">
          <div class="k-lbl">إجمالي المحصل</div>
          <div class="k-val" style="color: #0f172a;">${analytics.totalCollected.toLocaleString()} ج.م</div>
        </div>
        <div class="kpi-box capital">
          <div class="k-lbl">رأس مال البضاعة</div>
          <div class="k-val" style="color: #0369a1;">${analytics.totalGoodsCostRecovered.toLocaleString()} ج.م</div>
        </div>
        <div class="kpi-box deduction">
          <div class="k-lbl">الشحن والرسوم</div>
          <div class="k-val" style="color: #be123c;">-${analytics.totalShippingAndCarrier.toLocaleString()} ج.م</div>
        </div>
        <div class="kpi-box deduction">
          <div class="k-lbl">العمولة والتسويق</div>
          <div class="k-val" style="color: #b45309;">-${(analytics.totalServiceFees + analytics.totalMarketingCosts).toLocaleString()} ج.م</div>
        </div>
        <div class="kpi-box profit">
          <div class="k-lbl">صافي الربح / الخسارة</div>
          <div class="k-val" style="color: ${isProfit ? '#047857' : '#b91c1c'};">
            ${isProfit ? '+' : ''}${analytics.merchantNetProfitOrLoss.toLocaleString()} ج.م
          </div>
        </div>
        <div class="kpi-box net-final">
          <div class="k-lbl">الصافي النهائي للموكل</div>
          <div class="k-val" style="color: #34d399;">${analytics.netPayoutToMerchant.toLocaleString()} ج.م</div>
        </div>
      </div>

      <!-- Section 1: Product Movement Breakdown -->
      <div class="section-bar">
        <span class="sec-title">أولاً: بيان حركة المنتجات المباعة والمرتجعة وأرباح كل صنف</span>
        <span class="sec-count">${analytics.productMovements.length} أصناف</span>
      </div>
      <table>
        <colgroup>
          <col style="width: 4%;" />
          <col style="width: 31%;" />
          <col style="width: 7%;" />
          <col style="width: 7%;" />
          <col style="width: 7%;" />
          <col style="width: 8%;" />
          <col style="width: 11%;" />
          <col style="width: 11%;" />
          <col style="width: 11%;" />
          <col style="width: 13%;" />
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th class="text-right">اسم المنتج / الصنف</th>
            <th>المطلوب</th>
            <th>المسلّم</th>
            <th>المرتجع</th>
            <th>الارتجاع</th>
            <th>إجمالي المبيعات</th>
            <th>تكلفة البضاعة</th>
            <th>المصروفات المحملة</th>
            <th>صافي ربح الصنف</th>
          </tr>
        </thead>
        <tbody>
          ${analytics.productMovements.length === 0 ? `
            <tr>
              <td colspan="10" style="padding: 16px; color: #64748b;">لا توجد حركة منتجات مسجلة في هذه الفترة</td>
            </tr>
          ` : analytics.productMovements.map((p, idx) => {
            const shortSku = formatSku(p.sku);
            const pProfit = p.netProfit >= 0;
            return `
              <tr>
                <td class="num-cell">${idx + 1}</td>
                <td class="text-right" style="font-weight: 800; color: #0f172a;">
                  <div>${p.name}</div>
                  ${shortSku ? `<span class="sku-sub">كود: ${shortSku}</span>` : ''}
                </td>
                <td class="num-cell">${p.totalQuantityOrdered}</td>
                <td class="num-cell" style="color: #15803d; font-weight: 800;">${p.quantityDelivered}</td>
                <td class="num-cell" style="color: #b91c1c; font-weight: 800;">${p.quantityReturned}</td>
                <td class="num-cell" style="color: ${p.returnRate > 25 ? '#dc2626' : '#475569'};">${p.returnRate}%</td>
                <td class="num-cell"><span class="ltr-val">${p.totalDeliveredSales.toLocaleString()}</span> ج.م</td>
                <td class="num-cell" style="color: #0369a1;"><span class="ltr-val">${p.totalDeliveredCost.toLocaleString()}</span> ج.م</td>
                <td class="num-cell" style="color: #be123c;"><span class="ltr-val">-${p.allocatedExpenses.toLocaleString()}</span> ج.م</td>
                <td class="num-cell" style="font-weight: 900; color: ${pProfit ? '#15803d' : '#b91c1c'}; background: ${pProfit ? '#f0fdf4' : '#fef2f2'};">
                  <span class="ltr-val">${pProfit ? '+' : ''}${p.netProfit.toLocaleString()}</span> ج.م
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
        ${analytics.productMovements.length > 0 ? `
          <tfoot>
            <tr>
              <td colspan="2" class="text-right">إجمالي حركة الأصناف (${analytics.productMovements.length} صنف)</td>
              <td>${totalOrderedUnits}</td>
              <td style="color: #15803d;">${totalDeliveredUnits}</td>
              <td style="color: #b91c1c;">${totalReturnedUnits}</td>
              <td>${analytics.returnRate}%</td>
              <td><span class="ltr-val">${Math.round(totalSalesSum * 100) / 100}</span> ج.م</td>
              <td style="color: #0369a1;"><span class="ltr-val">${Math.round(totalCostSum * 100) / 100}</span> ج.م</td>
              <td style="color: #be123c;"><span class="ltr-val">-${Math.round(totalExpSum * 100) / 100}</span> ج.م</td>
              <td style="color: ${totalNetProfitSum >= 0 ? '#15803d' : '#b91c1c'};">
                <span class="ltr-val">${totalNetProfitSum >= 0 ? '+' : ''}${Math.round(totalNetProfitSum * 100) / 100}</span> ج.م
              </td>
            </tr>
          </tfoot>
        ` : ''}
      </table>

      <!-- Section 2: Itemized Order Ledger -->
      <div class="section-bar">
        <span class="sec-title">ثانياً: البيان المحاسبي التفصيلي للطلبات والشحنات</span>
        <span class="sec-count">${analytics.orderRows.length} طلبات</span>
      </div>
      <table>
        <colgroup>
          <col style="width: 9%;" />
          <col style="width: 9%;" />
          <col style="width: 14%;" />
          <col style="width: 18%;" />
          <col style="width: 9%;" />
          <col style="width: 8%;" />
          <col style="width: 8%;" />
          <col style="width: 8%;" />
          <col style="width: 8%;" />
          <col style="width: 9%;" />
        </colgroup>
        <thead>
          <tr>
            <th>رقم الطلب</th>
            <th>التاريخ</th>
            <th class="text-right">العميل والمحافظة</th>
            <th class="text-right">الأصناف</th>
            <th>الحالة</th>
            <th>التحصيل</th>
            <th>رأس المال</th>
            <th>الشحن والرسوم</th>
            <th>العمولة والتسويق</th>
            <th>صافي الموكل</th>
          </tr>
        </thead>
        <tbody>
          ${analytics.orderRows.length === 0 ? `
            <tr>
              <td colspan="10" style="padding: 16px; color: #64748b;">لا توجد طلبات مسجلة في هذه الفترة</td>
            </tr>
          ` : analytics.orderRows.slice(0, 150).map(o => {
            const netPos = o.netMerchantAmount >= 0;
            const cleanStatus = String(o.status || '').replace(/_/g, ' ');
            return `
              <tr>
                <td class="num-cell" style="font-weight: 900; color: #0f172a;">#${o.orderNumber}</td>
                <td class="num-cell">${new Date(o.date).toLocaleDateString('ar-EG')}</td>
                <td class="text-right">
                  <div style="font-weight: 800; color: #0f172a;">${o.customerName}</div>
                  ${o.city ? `<div style="font-size: 8.5px; color: #64748b;">${o.city}</div>` : ''}
                </td>
                <td class="text-right" style="font-size: 9px; color: #334155;">${o.itemsSummary || 'منتج عام'}</td>
                <td>
                  <span class="badge ${o.isDelivered ? 'badge-delivered' : o.isReturn ? 'badge-return' : 'badge-pending'}">
                    ${cleanStatus}
                  </span>
                </td>
                <td class="num-cell"><span class="ltr-val">${o.collectedAmount.toLocaleString()}</span> ج.م</td>
                <td class="num-cell" style="color: #0369a1;"><span class="ltr-val">${o.merchantGoodsCost.toLocaleString()}</span> ج.م</td>
                <td class="num-cell" style="color: #be123c;"><span class="ltr-val">-${o.totalShippingAndCarrier.toLocaleString()}</span> ج.م</td>
                <td class="num-cell" style="color: #b45309;"><span class="ltr-val">-${(o.serviceFee + o.marketingFee).toLocaleString()}</span> ج.م</td>
                <td class="num-cell" style="font-weight: 900; color: ${netPos ? '#15803d' : '#b91c1c'}; background: ${netPos ? '#f0fdf4' : '#fef2f2'};">
                  <span class="ltr-val">${o.netMerchantAmount.toLocaleString()}</span> ج.م
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
        ${analytics.orderRows.length > 0 ? `
          <tfoot>
            <tr>
              <td colspan="5" class="text-right">الإجمالي الكلي للطلبات (${analytics.orderRows.length} طلب)</td>
              <td><span class="ltr-val">${analytics.totalCollected.toLocaleString()}</span> ج.م</td>
              <td style="color: #0369a1;"><span class="ltr-val">${analytics.totalGoodsCostRecovered.toLocaleString()}</span> ج.م</td>
              <td style="color: #be123c;"><span class="ltr-val">-${analytics.totalShippingAndCarrier.toLocaleString()}</span> ج.م</td>
              <td style="color: #b45309;"><span class="ltr-val">-${(analytics.totalServiceFees + analytics.totalMarketingCosts).toLocaleString()}</span> ج.م</td>
              <td style="color: ${analytics.netPayoutToMerchant >= 0 ? '#15803d' : '#b91c1c'};">
                <span class="ltr-val">${analytics.netPayoutToMerchant.toLocaleString()}</span> ج.م
              </td>
            </tr>
          </tfoot>
        ` : ''}
      </table>

      <!-- Final Payout Banner -->
      <div class="summary-banner">
        <div>
          <div class="title">الصافي النهائي المستحق للتحويل للموكل (${analytics.merchantDisplayName})</div>
          <div class="formula">
            المعادلة المحاسبية: استرداد رأس مال البضاعة المباعة (${analytics.totalGoodsCostRecovered.toLocaleString()} ج.م)
            ${isProfit ? `+ صافي أرباح الموكل بعد المصاريف (${analytics.merchantNetProfitOrLoss.toLocaleString()} ج.م)` : `- صافي خسائر المرتجعات والمصاريف (${Math.abs(analytics.merchantNetProfitOrLoss).toLocaleString()} ج.م)`}
          </div>
        </div>
        <div class="amount">${analytics.netPayoutToMerchant.toLocaleString()} ج.م</div>
      </div>

      <!-- Official Signatures -->
      <div class="signatures-grid">
        <div>
          <div>إعداد ومراجعة الحسابات</div>
          <div class="sig-line"></div>
        </div>
        <div>
          <div>اعتماد إدارة ${storeName}</div>
          <div class="sig-line"></div>
        </div>
        <div>
          <div>توقيع ومطابقة الموكل (${analytics.merchantDisplayName})</div>
          <div class="sig-line"></div>
        </div>
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
