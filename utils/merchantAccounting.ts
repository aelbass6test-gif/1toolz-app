import type { MerchantSettlement, MerchantTransaction, Order, OrderItem, Treasury, TreasuryTransaction } from '../types';
import { normalizeMerchantId } from './merchantProducts';

export type MerchantSettlementStatus = 'draft' | 'pending' | 'approved' | 'paid' | 'cancelled';

export interface MerchantSettlementLine {
  orderId: string;
  merchantId: string;
  itemIds: string[];
  quantity: number;
  valueBasis: number;
  collectedAmount: number;
  goodsCost: number;
  shippingFee: number;
  codFee: number;
  insuranceFee: number;
  inspectionFee: number;
  vatFee: number;
  marketingFee: number;
  serviceFee: number;
  returnFee: number;
  netPayout: number;
}

export interface SettlementCalculation {
  complete: boolean;
  reason?: string;
  merchantId: string;
  orderId: string;
  lines: MerchantSettlementLine[];
  totals: Omit<MerchantSettlementLine, 'orderId' | 'merchantId' | 'itemIds' | 'quantity' | 'valueBasis'>;
}

const money = (value: number) => Math.round((Number(value) || 0) * 100) / 100;
const positive = (value: unknown) => Math.max(0, Number(value) || 0);
const itemMerchantId = (item: any) => normalizeMerchantId(item?.merchantId);
const orderMerchantId = (order: any) => normalizeMerchantId(order?.merchantId);

export const roundMoney = money;

export const getExplicitMerchantIds = (order: Partial<Order>): string[] => {
  const ids = new Set<string>();
  const headerId = orderMerchantId(order);
  if (headerId && headerId !== 'pending') ids.add(headerId);
  (Array.isArray(order.items) ? order.items : []).forEach((item: any) => {
    const id = itemMerchantId(item);
    if (id && id !== 'pending') ids.add(id);
  });
  return [...ids];
};

export const getMerchantItems = (order: Partial<Order>, merchantId: string): OrderItem[] => {
  const target = normalizeMerchantId(merchantId);
  if (!target) return [];
  return (Array.isArray(order.items) ? order.items : []).filter((item: any) => itemMerchantId(item) === target);
};

/**
 * Splits order-level money once, by item value and falls back to quantity only when
 * no positive item values exist. Store/shared/name-only items are never included.
 */
export const calculateMerchantSettlement = (
  order: Partial<Order>,
  merchantId: string,
  fees: Partial<MerchantSettlementLine> = {}
): SettlementCalculation => {
  const target = normalizeMerchantId(merchantId);
  const items = getMerchantItems(order, target);
  if (!target || items.length === 0) {
    return { complete: false, reason: 'No explicit merchantId-owned items', merchantId: target, orderId: String(order.id || ''), lines: [], totals: emptyTotals() };
  }
  const allItems = Array.isArray(order.items) ? order.items : [];
  const value = (item: any) => positive(item.price) * positive(item.quantity || 1);
  const totalValue = allItems.reduce((sum, item: any) => sum + value(item), 0);
  const totalQty = allItems.reduce((sum, item: any) => sum + positive(item.quantity || 1), 0);
  const merchantValue = items.reduce((sum, item: any) => sum + value(item), 0);
  const merchantQty = items.reduce((sum, item: any) => sum + positive(item.quantity || 1), 0);
  const ratio = totalValue > 0 ? merchantValue / totalValue : (totalQty > 0 ? merchantQty / totalQty : 0);
  const allocate = (amount: unknown) => money(positive(amount) * ratio);
  const delivered = ['تم_التحصيل', 'مدفوعة', 'تم_التوصيل', 'تم_توصيلها'].includes(String(order.status || ''));
  const collected = delivered ? allocate((order as any).totalAmountOverride ?? order.totalPrice) : 0;
  const goodsCost = money(items.reduce((sum, item: any) => sum + positive(item.cost) * positive(item.quantity || 1), 0));
  const line: MerchantSettlementLine = {
    orderId: String(order.id || ''), merchantId: target,
    itemIds: items.map((item: any, index) => String(item.productId || item.variantId || `${order.id}:item:${index}`)),
    quantity: merchantQty, valueBasis: money(merchantValue), collectedAmount: collected,
    goodsCost, shippingFee: allocate(fees.shippingFee), codFee: allocate(fees.codFee),
    insuranceFee: allocate(fees.insuranceFee), inspectionFee: allocate(fees.inspectionFee), vatFee: allocate(fees.vatFee),
    marketingFee: allocate(fees.marketingFee), serviceFee: allocate(fees.serviceFee), returnFee: allocate(fees.returnFee),
    netPayout: money(collected - goodsCost - allocate(fees.shippingFee) - allocate(fees.codFee) - allocate(fees.insuranceFee) - allocate(fees.inspectionFee) - allocate(fees.vatFee) - allocate(fees.marketingFee) - allocate(fees.serviceFee) - allocate(fees.returnFee))
  };
  return { complete: true, merchantId: target, orderId: line.orderId, lines: [line], totals: sumLines([line]) };
};

const emptyTotals = (): SettlementCalculation['totals'] => ({ collectedAmount: 0, goodsCost: 0, shippingFee: 0, codFee: 0, insuranceFee: 0, inspectionFee: 0, vatFee: 0, marketingFee: 0, serviceFee: 0, returnFee: 0, netPayout: 0 });
const sumLines = (lines: MerchantSettlementLine[]) => lines.reduce((out, line) => {
  (Object.keys(emptyTotals()) as Array<keyof SettlementCalculation['totals']>).forEach(key => { out[key] = money(out[key] + line[key]); });
  return out;
}, emptyTotals());

export const settlementKey = (storeId: string, orderId: string, merchantId: string) => `${String(storeId).trim()}::${String(orderId).trim()}::${normalizeMerchantId(merchantId)}`;

export const createPendingSettlement = (params: { storeId: string; order: Order; merchantId: string; calculation?: SettlementCalculation; now?: string; batchId?: string; }): MerchantSettlement & { orderId: string; storeId: string; merchantId: string; idempotencyKey: string; calculationComplete: boolean; status: MerchantSettlementStatus } => {
  const { storeId, order, merchantId, calculation, now = new Date().toISOString(), batchId } = params;
  const key = settlementKey(storeId, order.id, merchantId);
  const calc = calculation || calculateMerchantSettlement(order, merchantId);
  const t = calc.totals;
  return {
    id: `msett_${key.replace(/[^a-z0-9:_-]/gi, '_')}`,
    settlementNumber: `SETT-${key}`,
    storeId, orderId: order.id, merchantId: normalizeMerchantId(merchantId), merchantName: String((order as any).merchantName || ''), batchId,
    date: now, ordersCount: 1, totalCollected: t.collectedAmount, totalMerchantGoodsCost: t.goodsCost, totalServiceFees: t.serviceFee,
    totalShippingCosts: money(t.shippingFee + t.insuranceFee + t.inspectionFee + t.vatFee), totalMarketingCosts: t.marketingFee,
    totalReturnFees: t.returnFee, totalCollectionFees: t.codFee, netPayoutToMerchant: t.netPayout,
    status: 'pending', calculationComplete: calc.complete, idempotencyKey: key,
    orderSnapshots: [{ orderId: order.id, orderNumber: order.orderNumber, date: String(order.date || now), status: String(order.status || ''), goodsCost: t.goodsCost, collectedAmount: t.collectedAmount, netMerchantAmount: t.netPayout }]
  } as any;
};

export const calculateMerchantBalance = (merchantId: string, settlements: any[] = [], transactions: MerchantTransaction[] = []): number => {
  const id = normalizeMerchantId(merchantId);
  if (!id) return 0;
  const settlementCredit = settlements.filter(s => normalizeMerchantId(s?.merchantId) === id && ['approved', 'paid'].includes(s?.status)).reduce((sum, s) => sum + Number(s.netPayoutToMerchant || 0), 0);
  const transactionNet = transactions.filter(tx => normalizeMerchantId(tx?.merchantId) === id && tx.type !== 'order_delivered').reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  return money(settlementCredit + transactionNet);
};

export const hasReferenceTransaction = (transactions: MerchantTransaction[] = [], settlementId: string, type: MerchantTransaction['type']) => transactions.some(tx => tx.referenceId === settlementId && tx.type === type);
export const hasTreasuryReference = (transactions: TreasuryTransaction[] = [], reference: string) => transactions.some(tx => tx.reference === reference);

export const canTransitionSettlement = (from: string, to: MerchantSettlementStatus) => {
  if (from === 'paid' || from === 'cancelled') return false;
  return (from === 'draft' || from === 'pending') && ['approved', 'cancelled'].includes(to) || from === 'approved' && ['paid', 'cancelled'].includes(to);
};

export const getSettlementStatusLabel = (status: string) => ({ draft: 'مسودة غير محسوبة', pending: 'بانتظار الاعتماد', approved: 'معتمد بانتظار الصرف', paid: 'مدفوع', cancelled: 'ملغي محفوظ' } as Record<string, string>)[status] || status;

export const canPaySettlement = (settlement: any, treasury: Treasury | undefined, accountId: string, amount: number) => {
  if (!settlement || settlement.status !== 'approved' || !settlement.calculationComplete || amount <= 0) return false;
  const account = treasury?.accounts?.find(a => a.id === accountId);
  return Boolean(account && Number(account.balance) >= amount);
};
