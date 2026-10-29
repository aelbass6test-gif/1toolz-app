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

export function calculateMerchantBalance(merchantId: string, settlements?: any[], transactions?: MerchantTransaction[], openingBalance?: number): number;
export function calculateMerchantBalance(settlements: MerchantSettlement[], transactions: MerchantTransaction[], merchantId: string, openingBalance?: number): number;
export function calculateMerchantBalance(
  first: string | MerchantSettlement[],
  second: MerchantSettlement[] | MerchantTransaction[] = [],
  third: MerchantTransaction[] | string = [],
  openingBalance = 0
): number {
  const merchantId = typeof first === 'string' ? first : String(third || '');
  const settlements = (typeof first === 'string' ? second : first) as MerchantSettlement[];
  const transactions = (typeof first === 'string' ? third : second) as MerchantTransaction[];
  const id = normalizeMerchantId(merchantId);
  if (!id) return 0;
  const uniqueSettlements = [...new Map(settlements.map((row, index) => [String(row?.idempotencyKey || row?.id || `settlement-${index}`), row])).values()];
  const uniqueTransactions = [...new Map(transactions.map((tx, index) => [String(tx?.id || `transaction-${index}`), tx])).values()];
  const settlementCredit = uniqueSettlements.filter(row => normalizeMerchantId(row?.merchantId) === id && ['approved', 'paid'].includes(row?.status) && !row.reversedAt)
    .reduce((sum, row) => sum + Number(row.netPayoutToMerchant || 0), 0);
  const transactionNet = uniqueTransactions.filter(tx => normalizeMerchantId(tx?.merchantId) === id && tx.type !== 'order_delivered' && !(tx.type === 'adjustment' && tx.referenceId?.endsWith(':cancel')))
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  return money(Number(openingBalance || 0) + settlementCredit + transactionNet);
}

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

export interface MerchantOrderLine extends OrderItem {
  merchantId?: string;
  ownerType?: 'store' | 'merchant' | 'shared';
}

/** Explicit item IDs take precedence; an explicit order ID is used only for non-store, non-shared legacy lines. */
export function getMerchantOrderGroups(order: Partial<Order>): Map<string, MerchantOrderLine[]> {
  const groups = new Map<string, MerchantOrderLine[]>();
  const orderId = normalizeMerchantId(order.merchantId);
  for (const raw of Array.isArray(order.items) ? order.items : []) {
    const line = raw as MerchantOrderLine;
    const merchantId = normalizeMerchantId(line.merchantId) || (line.ownerType === 'store' || line.ownerType === 'shared' ? '' : orderId);
    if (!merchantId || merchantId === 'pending') continue;
    groups.set(merchantId, [...(groups.get(merchantId) || []), line]);
  }
  return groups;
}

const settlementRowKey = (storeId: string, orderId: string, merchantId: string) =>
  `ms_${encodeURIComponent(storeId)}_${encodeURIComponent(orderId)}_${encodeURIComponent(normalizeMerchantId(merchantId))}`;

/** Create one immutable pending placeholder per order/merchant; repeated sync preserves existing rows. */
export function ensureOrderMerchantSettlements(existing: MerchantSettlement[] = [], storeId: string, order: Partial<Order>, date = new Date().toISOString()): MerchantSettlement[] {
  const groups = getMerchantOrderGroups(order);
  if (!order.id || !groups.size) return existing;
  const next = [...existing];
  for (const [merchantId, lines] of groups) {
    const key = settlementRowKey(storeId, order.id, merchantId);
    if (next.some(row => row.idempotencyKey === key || (row.orderId === order.id && normalizeMerchantId(row.merchantId) === merchantId))) continue;
    const goods = lines.reduce((sum, line) => sum + (Number(line.cost) || 0) * (Number(line.quantity) || 0), 0);
    const row: MerchantSettlement = {
      id: key, idempotencyKey: key, calculationComplete: false, orderId: order.id,
      settlementNumber: `MS-${String(order.id).slice(-8)}-${merchantId.slice(-8)}`, merchantId,
      merchantName: String(lines.find(line => line.merchantName)?.merchantName || order.merchantName || merchantId),
      date, ordersCount: 1, totalCollected: 0, totalMerchantGoodsCost: goods, totalServiceFees: 0,
      totalShippingCosts: 0, totalMarketingCosts: 0, totalReturnFees: 0, totalCollectionFees: 0,
      netPayoutToMerchant: goods, status: 'pending',
      orderSnapshots: [{ orderId: order.id, orderNumber: order.orderNumber, date: String(order.date || date), status: String(order.status || ''), merchantGoodsCost: goods, goodsCost: goods, netMerchantAmount: goods }]
    };
    next.push(row);
  }
  return next;
}

export function splitSettlementByOrder(batch: MerchantSettlement, storeId: string): MerchantSettlement[] {
  const merchantId = normalizeMerchantId(batch.merchantId);
  if (!merchantId || !batch.orderSnapshots?.length) return [];
  return batch.orderSnapshots.map((snapshot, index) => {
    const orderId = String(snapshot.orderId);
    const idempotencyKey = settlementRowKey(storeId, orderId, merchantId);
    const goods = Number(snapshot.merchantGoodsCost ?? snapshot.goodsCost ?? 0) || 0;
    return {
      ...batch, id: idempotencyKey, idempotencyKey, orderId, batchId: batch.id, calculationComplete: true,
      settlementNumber: `${batch.settlementNumber}-${String(index + 1).padStart(2, '0')}`, ordersCount: 1,
      totalCollected: Number(snapshot.collectedAmount ?? snapshot.collectedRevenue ?? 0) || 0,
      totalMerchantGoodsCost: goods, totalServiceFees: Number(snapshot.serviceFee || 0),
      totalShippingCosts: Number(snapshot.totalShippingAndCarrierFees ?? snapshot.shippingFee ?? 0),
      totalMarketingCosts: Number(snapshot.marketingCost ?? snapshot.marketingFee ?? 0),
      totalReturnFees: Number(snapshot.returnFee || 0), totalCollectionFees: Number(snapshot.collectionFee ?? snapshot.codFee ?? 0),
      netPayoutToMerchant: Number(snapshot.netMerchantAmount ?? snapshot.netPayoutToMerchant ?? 0) || 0,
      status: batch.status === 'draft' ? 'pending' : batch.status, orderSnapshots: [snapshot]
    };
  });
}

export function upsertOrderSettlements(existing: MerchantSettlement[], incoming: MerchantSettlement[]): MerchantSettlement[] {
  const keys = new Set(incoming.map(row => row.idempotencyKey).filter(Boolean));
  return [...incoming, ...existing.filter(row => !row.idempotencyKey || !keys.has(row.idempotencyKey))];
}

export function transitionMerchantSettlement(settlement: MerchantSettlement, status: MerchantSettlementStatus, patch: Partial<MerchantSettlement> = {}): MerchantSettlement {
  if (!canTransitionSettlement(settlement.status, status) && settlement.status !== status) throw new Error(`Cannot transition ${settlement.status} settlement to ${status}`);
  return { ...settlement, ...patch, status };
}

export function allocateMerchantWithdrawal(
  settlements: MerchantSettlement[] = [],
  merchantId: string,
  amount: number,
  referenceId: string,
  date = new Date().toISOString()
): { settlements: MerchantSettlement[]; paidSettlementIds: string[]; allocatedAmount: number; unappliedAmount: number } {
  const targetId = normalizeMerchantId(merchantId);
  const requested = money(positive(amount));
  if (!targetId || !referenceId || requested <= 0) {
    return { settlements, paidSettlementIds: [], allocatedAmount: 0, unappliedAmount: requested };
  }
  if (settlements.some(row => row.paymentReferences?.some(payment => payment.referenceId === referenceId))) {
    return { settlements, paidSettlementIds: [], allocatedAmount: 0, unappliedAmount: 0 };
  }

  let remaining = requested;
  let allocatedAmount = 0;
  const paidSettlementIds: string[] = [];
  const eligible = settlements
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => normalizeMerchantId(row.merchantId) === targetId && row.status === 'approved' && !row.reversedAt)
    .sort((a, b) => String(a.row.date || '').localeCompare(String(b.row.date || '')));
  const updated = [...settlements];

  for (const { row, index } of eligible) {
    if (remaining <= 0) break;
    const total = money(positive(row.netPayoutToMerchant));
    const alreadyPaid = Math.min(total, money(positive(row.paidAmount)));
    const outstanding = money(Math.max(0, total - alreadyPaid));
    if (outstanding <= 0) continue;
    const applied = Math.min(remaining, outstanding);
    const paidAmount = money(alreadyPaid + applied);
    updated[index] = {
      ...row,
      paidAmount,
      paymentReferences: [...(row.paymentReferences || []), { referenceId, amount: applied, date }],
      ...(paidAmount >= total ? { status: 'paid' as const } : {})
    };
    if (paidAmount >= total) paidSettlementIds.push(row.id);
    remaining = money(remaining - applied);
    allocatedAmount = money(allocatedAmount + applied);
  }

  return { settlements: updated, paidSettlementIds, allocatedAmount, unappliedAmount: money(Math.max(0, requested - allocatedAmount)) };
}

export function calculateMerchantOpeningBalance(storedBalance: number | undefined, settlements: MerchantSettlement[] = [], transactions: MerchantTransaction[] = [], merchantId: string): number {
  return money((Number(storedBalance) || 0) - calculateMerchantBalance(merchantId, settlements, transactions));
}

export function cancelUnpaidOrderSettlements(settlements: MerchantSettlement[], orderId: string, cancelledAt = new Date().toISOString()): MerchantSettlement[] {
  return settlements.map(row => row.orderId !== orderId || !['pending', 'approved', 'draft'].includes(row.status) ? row : {
    ...row, status: 'cancelled', cancelledAt, notes: [row.notes, `Cancelled for returned/cancelled order ${orderId} at ${cancelledAt}`].filter(Boolean).join('\n')
  });
}
