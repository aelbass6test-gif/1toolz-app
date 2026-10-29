import { Order, Settings, OrderItem, Product } from '../types';
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

const normalizeStr = (s: string) => 
  (s || '')
    .trim()
    .toLowerCase()
    .replace(/^(sup_|m_|part_)/, '')
    .replace(/أ|إ|آ/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, '');

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

export interface ShippingPerformanceItem {
  company: string;
  totalOrders: number;
  deliveredCount: number;
  successRate: number;
  totalShippingFees: number;
  netRevenue: number;
}

export interface GeoPerformanceItem {
  region: string;
  totalOrders: number;
  deliveredCount: number;
  successRate: number;
  netRevenue: number;
}

export interface PartnerPerformanceItem {
  id: string;
  name: string;
  initialCapital: number;
  currentCapital: number;
  profitRatio: number;
  shareOfProfit: number;
  withdrawals: number;
  balance: number;
  goodsShare: number;
  cashShare: number;
}

export interface ExpenseCategoryItem {
  category: string;
  label: string;
  amount: number;
}

export interface MiniTrialBalance {
  assets: { label: string; amount: number }[];
  liabilities: { label: string; amount: number }[];
  totalAssets: number;
  totalLiabilities: number;
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

  // POS specific
  posCount: number;
  posCollected: number;
  posProfit: number;

  // Net results
  netPayoutToMerchant: number;
  merchantNetProfitOrLoss: number;
  roiPercentage: number;

  // Granular data
  productMovements: ProductMovementItem[];
  orderRows: TransparencyOrderRow[];
  
  // Performance Summaries
  shippingPerformance: ShippingPerformanceItem[];
  geoPerformance: GeoPerformanceItem[];
  expenseBreakdown: ExpenseCategoryItem[];
  partnerDistributions: PartnerPerformanceItem[];
  trialBalance: MiniTrialBalance;
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

  const manualShippingFee = (order.isManualShippingOverride && order.shippingFee !== undefined) ? order.shippingFee : null;
  const baseShippingFee = manualShippingFee !== null 
    ? manualShippingFee 
    : (Number(order.shippingFee) > 0 ? Number(order.shippingFee) : getStandardShippingFee(order, settings));

  const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings?.enableInsurance ? settings.insuranceFeePercent : 0);
  const isInsured = order.isInsured ?? true;
  const calculatedInsurance = isInsured ? calculateInsuranceFee(order, insuranceRate, settings) : 0;
  const insuranceFee = Number((
    (order.insuranceFee !== undefined && order.insuranceFee !== null && Number(order.insuranceFee) > 0)
      ? Number(order.insuranceFee)
      : calculatedInsurance
  ).toFixed(2));

  const inspectionCost = useCustom ? (compFees?.inspectionFee ?? 0) : (settings?.enableInspection ? (settings.inspectionFee ?? 0) : 0);
  const inspectionFee = Number((
    (order.includeInspectionFee !== false)
      ? ((order.inspectionFee !== undefined && order.inspectionFee !== null && Number(order.inspectionFee) > 0)
          ? Number(order.inspectionFee)
          : inspectionCost)
      : 0
  ).toFixed(2));

  const isExchange = order.status === 'تم_الاستبدال';
  const codFee = Number(((isDelivered || order.status === 'تم_الارسال' || order.status === 'قيد_الشحن') && order.status !== 'مدفوعة' && !isExchange ? calculateCodFee(order, settings) : 0).toFixed(2));

  const vatFee = Number((
    (order.vatValue !== undefined && order.vatValue !== null && Number(order.vatValue) > 0)
      ? Number(order.vatValue)
      : calculateBostaVat({ ...order, shippingFee: baseShippingFee }, insuranceFee, settings)
  ).toFixed(2));

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
  const hasMerchant = Boolean(
    (order.merchantId && order.merchantId !== 'pending') ||
    (order.items || []).some(item => Boolean(item.merchantId && item.merchantId !== 'pending'))
  );

  if (!hasMerchant) return false;
  if (!merchantIdOrName || merchantIdOrName === 'all') return true;

  const targetId = normalizeStr(merchantObj?.id || merchantIdOrName);
  const oMId = normalizeStr(order.merchantId || '');
  const hasLineOwnership = (order.items || []).some(item => Boolean(item.merchantId || item.ownerType));
  if (targetId && oMId === targetId && !hasLineOwnership) return true;

  const hasItemMatch = (order.items || []).some(item => {
    const iMId = normalizeStr(item.merchantId || '');
    return Boolean(targetId && iMId === targetId);
  });

  return hasItemMatch;
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

  let filtered = allOrders.filter(o => isOrderForMerchant(o, merchantIdOrName, merchantObj));

  const now = new Date();
  if (dateRange === 'today') {
    const todayStr = now.toISOString().split('T')[0];
    filtered = filtered.filter(o => (o.date || '').startsWith(todayStr));
  } else if (dateRange === '7days') {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    filtered = filtered.filter(o => new Date(o.date) >= sevenDaysAgo);
  } else if (dateRange === 'month') {
    const currentYearMonth = now.toISOString().slice(0, 7);
    filtered = filtered.filter(o => (o.date || '').startsWith(currentYearMonth));
  } else if (dateRange === 'custom' && (startDate || endDate)) {
    if (startDate) filtered = filtered.filter(o => (o.date || '').slice(0, 10) >= startDate);
    if (endDate) filtered = filtered.filter(o => (o.date || '').slice(0, 10) <= endDate);
  }

  if (settlementStatus === 'settled') {
    filtered = filtered.filter(o => o.settlementStatus === 'settled' || !!o.settlementId);
  } else if (settlementStatus === 'unsettled') {
    filtered = filtered.filter(o => o.settlementStatus !== 'settled' && !o.settlementId);
  }

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

  const orderRows: TransparencyOrderRow[] = [];
  const productMovementMap = new Map<string, ProductMovementItem>();
  const shippingMap = new Map<string, ShippingPerformanceItem>();
  const geoMap = new Map<string, GeoPerformanceItem>();

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
  let netPayoutToMerchant = 0;

  let deliveredCount = 0;
  let returnCount = 0;
  let pendingDeliveryCount = 0;
  let posCount = 0;
  let posCollected = 0;
  let posProfit = 0;

  filtered.forEach(o => {
    const isDelivered = TRANSPARENCY_DELIVERED_STATUSES.includes(o.status);
    const isReturn = TRANSPARENCY_RETURN_STATUSES.includes(o.status);
    const isPos = o.channel === 'pos' || (o.id && o.id.startsWith('POS-'));

    if (isDelivered) deliveredCount++;
    else if (isReturn) returnCount++;
    else pendingDeliveryCount++;

    const carrierCalc = computeOrderCarrierBreakdown(o, settings);
    const allItems = o.items || [];
    const relevantItems = allItems.filter(item => {
      const iMId = normalizeStr(item.merchantId || '');
      const targetId = normalizeStr(merchantObj?.id || merchantIdOrName);
      return Boolean(targetId && iMId === targetId);
    });

    const merchantItems = relevantItems.length === 0 ? allItems : relevantItems;
    const totalOrderQty = allItems.reduce((s, i) => s + (i.quantity || 1), 0) || 1;
    const merchantQty = merchantItems.reduce((s, i) => s + (i.quantity || 1), 0);
    const ratio = merchantQty / totalOrderQty;

    const fullCollected = isDelivered 
      ? (o.totalAmountOverride !== undefined && o.totalAmountOverride !== null && Number(o.totalAmountOverride) > 0
          ? Number(o.totalAmountOverride)
          : (Number(o.totalPrice) || 0))
      : 0;
    const collected = fullCollected * ratio;
    const goodsCost = merchantItems.reduce((sum, item) => sum + ((item.cost || 0) * (item.quantity || 1)), 0);
    const marketingFee = (Number(o.marketingFeePerOrder) || 0) * ratio;
    const defaultService = (settings as any).defaultMerchantServiceFee ?? 0;
    const serviceFee = isDelivered ? ((o.serviceFeePerOrder !== undefined ? o.serviceFeePerOrder : defaultService) * ratio) : 0;
    const returnLoss = isReturn ? ((carrierCalc.totalShippingAndCarrier + (Number(o.marketingFeePerOrder) || 0)) * ratio) : 0;

    let netMerchantAmount = 0;
    let merchantProfitOrLoss = 0;

    if (o.merchantSettlementMode === 'profit_share') {
      const sharePct = (o.merchantProfitSharePercent || 50) / 100;
      const expenses = (carrierCalc.totalShippingAndCarrier + (Number(o.marketingFeePerOrder) || 0)) * ratio;
      const netMargin = collected - (isDelivered ? goodsCost : 0) - expenses;
      const merchantShare = netMargin * sharePct;
      netMerchantAmount = (isDelivered ? goodsCost : 0) + merchantShare;
      merchantProfitOrLoss = isDelivered ? merchantShare : (-returnLoss);
    } else if (o.merchantSettlementMode === 'wholesale') {
      const deductions = serviceFee + (carrierCalc.totalShippingAndCarrier * ratio) + marketingFee;
      netMerchantAmount = isDelivered ? (goodsCost - deductions) : (-deductions);
      merchantProfitOrLoss = isDelivered ? (netMerchantAmount - goodsCost) : (-returnLoss);
    } else {
      const deductions = serviceFee + (carrierCalc.totalShippingAndCarrier * ratio) + marketingFee;
      netMerchantAmount = isDelivered ? (collected - deductions) : (-deductions);
      merchantProfitOrLoss = isDelivered ? (netMerchantAmount - goodsCost) : (-returnLoss);
    }

    totalCollected += collected;
    if (isDelivered) {
      totalGoodsCostRecovered += goodsCost;
      totalServiceFees += serviceFee;
    }
    totalBaseShipping += carrierCalc.baseShippingFee * ratio;
    totalInsurance += carrierCalc.insuranceFee * ratio;
    totalInspection += carrierCalc.inspectionFee * ratio;
    totalVat += carrierCalc.vatFee * ratio;
    totalCodFees += carrierCalc.codFee * ratio;
    totalCarrierAdditionalFees += carrierCalc.carrierAdditionalFees * ratio;
    totalShippingAndCarrier += carrierCalc.totalShippingAndCarrier * ratio;
    totalMarketingCosts += marketingFee;
    if (isReturn) totalReturnLosses += returnLoss;
    netPayoutToMerchant += netMerchantAmount;

    if (isPos) {
      posCount++;
      posCollected += collected;
      posProfit += merchantProfitOrLoss;
    }

    const shipCo = o.shippingCompany || 'بدون شركة';
    const sPerf = shippingMap.get(shipCo) || { company: shipCo, totalOrders: 0, deliveredCount: 0, successRate: 0, totalShippingFees: 0, netRevenue: 0 };
    sPerf.totalOrders++;
    if (isDelivered) { sPerf.deliveredCount++; sPerf.netRevenue += collected; }
    sPerf.totalShippingFees += (carrierCalc.totalShippingAndCarrier * ratio);
    shippingMap.set(shipCo, sPerf);

    const region = o.city || o.customerCity || o.governorate || 'غير محدد';
    const gPerf = geoMap.get(region) || { region, totalOrders: 0, deliveredCount: 0, successRate: 0, netRevenue: 0 };
    gPerf.totalOrders++;
    if (isDelivered) { gPerf.deliveredCount++; gPerf.netRevenue += collected; }
    geoMap.set(region, gPerf);

    const itemsSummary = merchantItems.map(i => `${i.name || i.productName || 'منتج'} (x${i.quantity || 1})`).join('، ');
    orderRows.push({
      orderId: o.id, orderNumber: o.orderNumber || o.id, date: o.date, customerName: o.customerName || 'عميل', customerPhone: o.customerPhone,
      city: region, shippingCompany: o.shippingCompany, status: o.status, isDelivered, isReturn, itemsSummary, itemsCount: merchantQty,
      rawItems: merchantItems, collectedAmount: Math.round(collected * 100) / 100, merchantGoodsCost: Math.round(goodsCost * 100) / 100,
      baseShippingFee: Math.round((carrierCalc.baseShippingFee * ratio) * 100) / 100, insuranceFee: Math.round((carrierCalc.insuranceFee * ratio) * 100) / 100,
      inspectionFee: Math.round((carrierCalc.inspectionFee * ratio) * 100) / 100, vatFee: Math.round((carrierCalc.vatFee * ratio) * 100) / 100,
      codFee: Math.round((carrierCalc.codFee * ratio) * 100) / 100, carrierAdditionalFees: Math.round((carrierCalc.carrierAdditionalFees * ratio) * 100) / 100,
      totalShippingAndCarrier: Math.round((carrierCalc.totalShippingAndCarrier * ratio) * 100) / 100, serviceFee: Math.round(serviceFee * 100) / 100,
      marketingFee: Math.round(marketingFee * 100) / 100, returnLoss: Math.round(returnLoss * 100) / 100, netMerchantAmount: Math.round(netMerchantAmount * 100) / 100,
      merchantProfitOrLoss: Math.round(merchantProfitOrLoss * 100) / 100, settlementStatus: o.settlementStatus, settlementId: o.settlementId, rawOrder: o
    });

    const totalItemsInOrderForProds = merchantItems.reduce((acc, it) => acc + (it.quantity || 1), 0) || 1;
    merchantItems.forEach(item => {
      const key = item.productId || item.name || 'unknown';
      const rawSku = String((item as any).sku || item.productId || '').trim();
      const formattedSku = !rawSku || rawSku === 'general' || rawSku === 'p_unknown' || rawSku === '-' ? '—' : (rawSku.startsWith('wuilt_prod_') || rawSku.length > 14) ? `SKU-${rawSku.replace(/^wuilt_prod_/i, '').split('_')[0].slice(-6).toUpperCase()}` : rawSku;
      const existing = productMovementMap.get(key) || {
        productId: item.productId || 'p_unknown', sku: formattedSku, name: item.name || (item as any).productName || 'منتج',
        image: item.thumbnail || item.image, totalQuantityOrdered: 0, quantityDelivered: 0, totalDeliveredSales: 0, totalDeliveredCost: 0,
        quantityReturned: 0, returnRate: 0, allocatedExpenses: 0, netProfit: 0
      };
      const itemQty = item.quantity || 1;
      const proportion = itemQty / totalItemsInOrderForProds;
      existing.totalQuantityOrdered += itemQty;
      if (isDelivered) {
        const itemCollected = collected * proportion;
        existing.quantityDelivered += itemQty;
        existing.totalDeliveredSales += itemCollected;
        existing.totalDeliveredCost += ((item.cost || 0) * itemQty);
        const orderExp = (carrierCalc.totalShippingAndCarrier * ratio) + serviceFee + marketingFee;
        const itemAllocatedExp = orderExp * proportion;
        existing.allocatedExpenses += Math.round(itemAllocatedExp * 100) / 100;
        const itemNetProfit = itemCollected - itemAllocatedExp - ((item.cost || 0) * itemQty);
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

  const shippingPerformance = Array.from(shippingMap.values()).map(s => ({ ...s, successRate: s.totalOrders > 0 ? Math.round((s.deliveredCount / s.totalOrders) * 1000) / 10 : 0, netRevenue: Math.round(s.netRevenue * 100) / 100, totalShippingFees: Math.round(s.totalShippingFees * 100) / 100 })).sort((a, b) => b.totalOrders - a.totalOrders);
  const geoPerformance = Array.from(geoMap.values()).map(g => ({ ...g, successRate: g.totalOrders > 0 ? Math.round((g.deliveredCount / g.totalOrders) * 1000) / 10 : 0, netRevenue: Math.round(g.netRevenue * 100) / 100 })).sort((a, b) => b.totalOrders - a.totalOrders);
  const expenseBreakdown: ExpenseCategoryItem[] = [{ category: 'shipping', label: 'لوجستيات وشحن', amount: Math.round(totalShippingAndCarrier * 100) / 100 }, { category: 'marketing', label: 'إعلانات وتسويق', amount: Math.round(totalMarketingCosts * 100) / 100 }, { category: 'service', label: 'عمولات تشغيل', amount: Math.round(totalServiceFees * 100) / 100 }, { category: 'returns', label: 'خسائر مرتجعات', amount: Math.round(totalReturnLosses * 100) / 100 }];
  
  const partnerDistributions: PartnerPerformanceItem[] = [];
  const targetMerchant = settings.suppliers?.find(s => normalizeStr(s.id) === normalizeStr(merchantIdOrName));
  const merchantNetProfitOrLoss = Math.round((netPayoutToMerchant - totalGoodsCostRecovered) * 100) / 100;

  if (targetMerchant) {
    const initialCapital = (targetMerchant as any).initialCapital ?? 0;
    const balance = (targetMerchant.balance ?? 0);
    const mId = normalizeStr(targetMerchant.id);
    const merchantOwnedProducts = (settings.products || []).filter((p: Product) => normalizeStr(p.merchantId || '') === mId || (p.merchantAllocations || []).some((a: any) => normalizeStr(a.merchantId) === mId));
    const currentInventoryValue = merchantOwnedProducts.reduce((sum, p) => {
      const alloc = (p.merchantAllocations || []).find((a: any) => normalizeStr(a.merchantId) === mId);
      const cost = alloc?.costPrice ?? p.costPrice ?? 0;
      const stock = alloc?.stock ?? p.stockQuantity ?? 0;
      return sum + (cost * stock);
    }, 0);

    partnerDistributions.push({ id: targetMerchant.id, name: targetMerchant.name, initialCapital, currentCapital: initialCapital + merchantNetProfitOrLoss, profitRatio: 100, shareOfProfit: merchantNetProfitOrLoss, withdrawals: 0, balance, goodsShare: Math.round(currentInventoryValue * 100) / 100, cashShare: Math.max(0, Math.round((balance - currentInventoryValue) * 100) / 100) });
  }

  const totalAllDeductionsFinal = Math.round((totalShippingAndCarrier + totalServiceFees + totalMarketingCosts) * 100) / 100;
  const trialBalance: MiniTrialBalance = { assets: [{ label: 'رصيد المحفظة الجاري', amount: Math.max(0, netPayoutToMerchant) }, { label: 'قيمة المخزون الحالي (المخزن)', amount: partnerDistributions[0]?.goodsShare || 0 }], liabilities: [{ label: 'تكاليف ومصاريف معلقة', amount: totalAllDeductionsFinal + totalReturnLosses }], totalAssets: netPayoutToMerchant + (partnerDistributions[0]?.goodsShare || 0), totalLiabilities: totalAllDeductionsFinal + totalReturnLosses };

  const productMovements = Array.from(productMovementMap.values()).map(p => ({ ...p, returnRate: (p.quantityDelivered + p.quantityReturned) > 0 ? Math.round((p.quantityReturned / (p.quantityDelivered + p.quantityReturned)) * 1000) / 10 : 0, totalDeliveredSales: Math.round(p.totalDeliveredSales * 100) / 100, totalDeliveredCost: Math.round(p.totalDeliveredCost * 100) / 100, allocatedExpenses: Math.round(p.allocatedExpenses * 100) / 100, netProfit: Math.round(p.netProfit * 100) / 100 })).sort((a, b) => b.totalDeliveredSales - a.totalDeliveredSales);

  const totalClosed = deliveredCount + returnCount;
  const deliverySuccessRate = totalClosed > 0 ? Math.round((deliveredCount / totalClosed) * 1000) / 10 : 0;
  const returnRate = totalClosed > 0 ? Math.round((returnCount / totalClosed) * 1000) / 10 : 0;
  const roiPercentage = totalGoodsCostRecovered > 0 ? Math.round((merchantNetProfitOrLoss / totalGoodsCostRecovered) * 1000) / 10 : 0;

  let dateRangeLabel = 'كل الفترات';
  if (dateRange === 'today') dateRangeLabel = 'اليوم';
  else if (dateRange === '7days') dateRangeLabel = 'آخر 7 أيام';
  else if (dateRange === 'month') dateRangeLabel = 'هذا الشهر';
  else if (dateRange === 'custom') dateRangeLabel = `${startDate || 'البداية'} إلى ${endDate || 'الآن'}`;

  return {
    merchantIdentifier: merchantIdOrName, merchantDisplayName: merchantObj?.name || merchantIdOrName || 'كافة الموكلين', dateRangeLabel,
    totalOrdersCount: filtered.length, deliveredCount, returnCount, pendingDeliveryCount, deliverySuccessRate, returnRate,
    totalCollected: Math.round(totalCollected * 100) / 100, totalGoodsCostRecovered: Math.round(totalGoodsCostRecovered * 100) / 100,
    totalBaseShipping: Math.round(totalBaseShipping * 100) / 100, totalCarrierAdditionalFees: Math.round(totalCarrierAdditionalFees * 100) / 100,
    totalInsurance: Math.round(totalInsurance * 100) / 100, totalInspection: Math.round(totalInspection * 100) / 100, totalVat: Math.round(totalVat * 100) / 100,
    totalCodFees: Math.round(totalCodFees * 100) / 100, totalShippingAndCarrier: Math.round(totalShippingAndCarrier * 100) / 100,
    totalServiceFees: Math.round(totalServiceFees * 100) / 100, totalMarketingCosts: Math.round(totalMarketingCosts * 100) / 100,
    totalReturnLosses: Math.round(totalReturnLosses * 100) / 100, totalAllDeductions: totalAllDeductionsFinal,
    posCount, posCollected: Math.round(posCollected * 100) / 100, posProfit: Math.round(posProfit * 100) / 100,
    netPayoutToMerchant: Math.round(netPayoutToMerchant * 100) / 100, merchantNetProfitOrLoss, roiPercentage, productMovements, orderRows,
    shippingPerformance, geoPerformance, expenseBreakdown, partnerDistributions, trialBalance
  };
}

/**
 * Export Multi-sheet Excel
 */
export function exportMerchantTransparencyExcel(analytics: TransparencyAnalyticsResult, storeName: string = 'المتجر') {
  const wb = XLSX.utils.book_new();
  const summaryData = [
    { 'البند': 'تقرير الشفافية للموكل', 'القيمة': '' },
    { 'البند': 'اسم الموكل', 'القيمة': analytics.merchantDisplayName },
    { 'البند': 'الفترة', 'القيمة': analytics.dateRangeLabel },
    { 'البند': 'إجمالي الطلبات', 'القيمة': analytics.totalOrdersCount },
    { 'البند': 'نسبة نجاح التسليم', 'القيمة': `${analytics.deliverySuccessRate}%` },
    { 'البند': 'إجمالي المحصل', 'القيمة': analytics.totalCollected },
    { 'البند': 'تكلفة البضاعة', 'القيمة': analytics.totalGoodsCostRecovered },
    { 'البند': 'صافي المستحق للموكل', 'القيمة': analytics.netPayoutToMerchant }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'الملخص المالي');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analytics.productMovements), 'حركة المنتجات');
  XLSX.writeFile(wb, `Transparency_Report_${analytics.merchantDisplayName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Generate Printable Official A4 Transparency Report
 */
export function printMerchantTransparencyReport(analytics: TransparencyAnalyticsResult, storeName: string = 'المتجر الإلكتروني') {
  const isProfit = analytics.merchantNetProfitOrLoss >= 0;
  const printDate = new Date().toLocaleDateString('ar-EG');
  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8"><title>تقرير الشفافية - ${analytics.merchantDisplayName}</title>
      <style>
        body { font-family: 'Cairo', sans-serif; font-size: 11px; padding: 20px; }
        .header { background: #0f172a; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
        th { background: #f8fafc; }
        .summary { background: #f0f9ff; padding: 15px; border-radius: 8px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="header"><h1>${storeName}</h1><p>تقرير الشفافية: ${analytics.merchantDisplayName} • ${analytics.dateRangeLabel}</p></div>
      <h3>ملخص الأداء</h3>
      <table>
        <tr><th>إجمالي الطلبات</th><th>المسلّم</th><th>المرتجع</th><th>نسبة النجاح</th><th>إجمالي المحصل</th><th>صافي المستحق</th></tr>
        <tr><td>${analytics.totalOrdersCount}</td><td>${analytics.deliveredCount}</td><td>${analytics.returnCount}</td><td>${analytics.deliverySuccessRate}%</td><td>${analytics.totalCollected}</td><td>${analytics.netPayoutToMerchant}</td></tr>
      </table>
      <h3>حركة المنتجات</h3>
      <table>
        <thead><tr><th>الصنف</th><th>المطلوب</th><th>المسلّم</th><th>المرتجع</th><th>صافي الربح</th></tr></thead>
        <tbody>${analytics.productMovements.map(p => `<tr><td>${p.name}</td><td>${p.totalQuantityOrdered}</td><td>${p.quantityDelivered}</td><td>${p.quantityReturned}</td><td>${p.netProfit}</td></tr>`).join('')}</tbody>
      </table>
      <div class="summary">الصافي النهائي للموكل: ${analytics.netPayoutToMerchant} ج.م</div>
    </body>
    </html>
  `;
  printHTMLDirectly(html);
}

/**
 * Generate and print the Official Comprehensive Merchant Report
 */
export function printComprehensiveMerchantReport(analytics: TransparencyAnalyticsResult, storeName: string = 'المتجر الإلكتروني') {
  const printDate = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>تقرير مالي شامل - ${analytics.merchantDisplayName}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        :root { --primary: #1e3a8a; --primary-light: #3b82f6; --success: #059669; --danger: #dc2626; --warning: #d97706; --slate-900: #0f172a; --slate-200: #e2e8f0; }
        @page { size: A4 landscape; margin: 8mm; }
        body { font-family: 'Cairo', sans-serif; background: #f1f5f9; color: var(--slate-900); margin: 0; padding: 0; line-height: 1.4; font-size: 11px; }
        .report-container { width: 100%; max-width: 1400px; margin: 0 auto; background: white; padding: 25px; }
        .header-banner { background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #1e3a8a 100%); color: white; padding: 20px 25px; border-radius: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
        .header-banner h1 { margin: 0; font-size: 24px; font-weight: 900; }
        .kpi-bar { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; }
        .kpi-box { background: white; padding: 12px; border-radius: 12px; border: 1px solid var(--slate-200); text-align: center; border-top: 4px solid var(--primary); }
        .kpi-label { font-size: 10px; color: #64748b; font-weight: 800; margin-bottom: 5px; }
        .kpi-value { font-size: 18px; font-weight: 900; }
        .section-header { font-size: 16px; font-weight: 900; color: var(--primary); margin: 25px 0 15px 0; border-bottom: 2px solid var(--slate-200); padding-bottom: 5px; display: flex; align-items: center; gap: 8px; }
        .modern-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .modern-table th { background: #f8fafc; padding: 10px; border: 1px solid var(--slate-200); font-weight: 800; }
        .modern-table td { padding: 8px; border: 1px solid var(--slate-200); text-align: center; }
        .final-banner { background: var(--slate-900); color: white; padding: 25px; border-radius: 15px; text-align: center; margin-top: 30px; }
        .final-banner .amount { font-size: 36px; font-weight: 900; color: #34d399; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="header-banner">
            <div><h1>${storeName}</h1><div style="color: #93c5fd; font-weight: 700;">📈 التقرير المالي الموحد والأداء الاستراتيجي الشامل</div></div>
            <div style="text-align: left;"><div style="font-weight: 800; font-size: 16px; background: rgba(255,255,255,0.15); padding: 5px 15px; border-radius: 20px;">${analytics.merchantDisplayName}</div><div style="font-size: 10px; margin-top: 5px;">${printDate}</div></div>
        </div>
        <div class="kpi-bar">
            <div class="kpi-box"><div class="kpi-label">إجمالي الطلبات</div><div class="kpi-value">${analytics.totalOrdersCount}</div></div>
            <div class="kpi-box" style="border-top-color: var(--success);"><div class="kpi-label">نسبة النجاح</div><div class="kpi-value">${analytics.deliverySuccessRate}%</div></div>
            <div class="kpi-box" style="border-top-color: var(--danger);"><div class="kpi-label">المصروفات</div><div class="kpi-value">${analytics.totalAllDeductions.toLocaleString()}</div></div>
            <div class="kpi-box" style="border-top-color: #8b5cf6;"><div class="kpi-label">رأس المال المسترد</div><div class="kpi-value">${analytics.totalGoodsCostRecovered.toLocaleString()}</div></div>
            <div class="kpi-box" style="border-top-color: #0284c7;"><div class="kpi-label">صافي المستحق</div><div class="kpi-value">${analytics.netPayoutToMerchant.toLocaleString()}</div></div>
        </div>
        <h2 class="section-header">1. الأداء التشغيلي والتحليل الجغرافي</h2>
        <div class="grid-2">
            <table class="modern-table"><thead><tr><th>شركة الشحن</th><th>الطلبات</th><th>النجاح</th><th>الصافي</th></tr></thead>
            <tbody>${analytics.shippingPerformance.map(s => `<tr><td>${s.company}</td><td>${s.totalOrders}</td><td>${s.successRate}%</td><td>${(s.netRevenue - s.totalShippingFees).toLocaleString()}</td></tr>`).join('')}</tbody></table>
            <table class="modern-table"><thead><tr><th>المحافظة</th><th>الطلبات</th><th>النجاح</th><th>التحصيل</th></tr></thead>
            <tbody>${analytics.geoPerformance.slice(0, 10).map(g => `<tr><td>${g.region}</td><td>${g.totalOrders}</td><td>${g.successRate}%</td><td>${g.netRevenue.toLocaleString()}</td></tr>`).join('')}</tbody></table>
        </div>
        <h2 class="section-header">2. ربحية المنتجات وحركة المخزون</h2>
        <table class="modern-table"><thead><tr><th>اسم المنتج</th><th>المباع</th><th>المرتجع</th><th>إجمالي المبيعات</th><th>تكلفة الجملة</th><th>صافي الربح</th></tr></thead>
        <tbody>${analytics.productMovements.slice(0, 15).map(p => `<tr><td style="text-align: right;">${p.name}</td><td>${p.quantityDelivered}</td><td>${p.quantityReturned}</td><td>${p.totalDeliveredSales.toLocaleString()}</td><td>${p.totalDeliveredCost.toLocaleString()}</td><td style="font-weight: 800; color: ${p.netProfit >= 0 ? 'var(--success)' : 'var(--danger)'}">${p.netProfit.toLocaleString()}</td></tr>`).join('')}</tbody></table>
        <h2 class="section-header">3. سجل التحصيل المالي (آخر 20 طلب)</h2>
        <table class="modern-table"><thead><tr><th>#</th><th>العميل</th><th>المنتجات</th><th>المحصل</th><th>التكلفة</th><th>الشحن</th><th>الصافي</th></tr></thead>
        <tbody>${analytics.orderRows.filter(o => o.isDelivered).slice(0, 20).map((o, i) => `<tr><td>${i+1}</td><td style="text-align: right;">${o.customerName}<br><small>${o.orderNumber}</small></td><td style="font-size: 9px;">${o.itemsSummary}</td><td>${o.collectedAmount}</td><td>${o.merchantGoodsCost}</td><td>${o.totalShippingAndCarrier}</td><td style="font-weight: 800; color: var(--success)">${o.netMerchantAmount}</td></tr>`).join('')}</tbody></table>
        <h2 class="section-header">4. توزيع المستحقات ومعادلة البضاعة</h2>
        <table class="modern-table"><thead><tr><th>الشريك</th><th>رأس المال</th><th>نصيب الأرباح</th><th>المسحوبات</th><th>الرصيد الكلي</th><th>حصة بضاعة</th><th>رصيد متاح</th></tr></thead>
        <tbody>${analytics.partnerDistributions.map(p => `<tr><td>${p.name}</td><td>${p.initialCapital}</td><td>${p.shareOfProfit}</td><td>${p.withdrawals}</td><td>${p.balance}</td><td>${p.goodsShare}</td><td>${p.cashShare}</td></tr>`).join('')}</tbody></table>
        <div class="final-banner"><div>إجمالي الصافي المستحق للموكل (رأس مال + أرباح)</div><div class="amount">${analytics.netPayoutToMerchant.toLocaleString()} ج.م</div><div style="margin-top: 10px; opacity: 0.8;">معدل العائد على الاستثمار (ROI): ${analytics.roiPercentage}%</div></div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-top: 40px; text-align: center;">
            <div><div style="font-weight: 800;">اعتماد المحاسبة المالية</div><div style="border-top: 1px dashed #aaa; width: 200px; margin: 20px auto;"></div></div>
            <div><div style="font-weight: 800;">موافقة الموكل / الشريك</div><div style="border-top: 1px dashed #aaa; width: 200px; margin: 20px auto;"></div></div>
        </div>
    </div>
</body></html>`;
  printHTMLDirectly(html);
}

/**
 * Generate formatted WhatsApp message text
 */
export function buildWhatsAppTransparencyText(analytics: TransparencyAnalyticsResult, storeName: string = 'المتجر'): string {
  const isProfit = analytics.merchantNetProfitOrLoss >= 0;
  let msg = `*تقرير الشفافية وحركة الحسابات المالية* 📊\n`;
  msg += `متجر: *${storeName}*\nالموكل: *${analytics.merchantDisplayName}*\nالفترة: *${analytics.dateRangeLabel}*\n\n`;
  msg += `📦 *حركة الشحنات:*\n• إجمالي الطلبات: ${analytics.totalOrdersCount}\n• نسبة النجاح: ${analytics.deliverySuccessRate}%\n\n`;
  msg += `💰 *الميزان المالي:*\n• إجمالي التحصيل: ${analytics.totalCollected.toLocaleString()} ج.م\n• استرداد رأس المال: ${analytics.totalGoodsCostRecovered.toLocaleString()} ج.م\n• صافي الأرباح: ${isProfit ? '+' : ''}${analytics.merchantNetProfitOrLoss.toLocaleString()} ج.م\n\n`;
  msg += `💵 *الصافي النهائي للموكل: ${analytics.netPayoutToMerchant.toLocaleString()} ج.م*\n\n`;
  msg += `كشف تفصيلي شفاف لضمان المصداقية 🤝`;
  return msg;
}
