export type CustodyLedgerEntryLike = {
  id?: string;
  notes?: string;
  orderId?: string;
  order_id?: string;
  orderNumber?: string;
  order_number?: string;
  isVirtual?: boolean;
  is_virtual?: boolean;
};

export type CustodySource = {
  orderId?: string | number | null;
  orderNumber?: string | number | null;
  kind: 'advance' | 'pos_collection';
};

export type CustodyBalanceSnapshot = {
  holderId: string;
  holderName: string;
  before: number;
  after: number;
  direction: 'in' | 'out' | 'settlement';
};
export type CustodyPaymentLike = { cashHolderId: string; amount: number };
export type CustodyHolderLike = { userId: string; currentBalance?: number };

export type CustodyLedgerDetails = {
  schemaVersion: 1;
  entryType: 'custody_ledger';
  sourceType: string;
  sourceId: string;
  performedByUserId: string;
  performedByUserName: string;
  recordedAt: string;
  balanceBefore?: number;
  balanceAfter?: number;
  balances: CustodyBalanceSnapshot[];
  destinationType?: string;
};

const clean = (value: unknown): string => String(value ?? '').trim();

export const sumCustodyPayments = (payments: CustodyPaymentLike[] = []): number =>
  payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

export const validateCustodyPayments = (
  payments: CustodyPaymentLike[],
  total: number,
  holders: CustodyHolderLike[],
  balancesToRestore: CustodyPaymentLike[] = []
): string | null => {
  const expected = Number(total) || 0;
  if (!payments.length) return 'يجب اختيار عهدة واحدة على الأقل لسداد الفاتورة.';
  if (payments.some(payment => !clean(payment.cashHolderId) || !Number.isFinite(Number(payment.amount)) || Number(payment.amount) <= 0)) {
    return 'يرجى اختيار صاحب العهدة وإدخال مبلغ صحيح وأكبر من صفر لكل دفعة.';
  }
  if (Math.abs(sumCustodyPayments(payments) - expected) > 0.01) {
    return `يجب أن يساوي مجموع السداد من العهد إجمالي الفاتورة (${expected.toLocaleString()} ج.م).`;
  }
  const holderIds = new Set(holders.map(holder => String(holder.userId)));
  if (payments.some(payment => !holderIds.has(String(payment.cashHolderId)))) {
    return 'يوجد صاحب عهدة غير موجود أو غير متاح حالياً.';
  }
  const restoredByHolder = new Map<string, number>();
  balancesToRestore.forEach(payment => {
    const id = String(payment.cashHolderId);
    restoredByHolder.set(id, (restoredByHolder.get(id) || 0) + (Number(payment.amount) || 0));
  });
  const requestedByHolder = new Map<string, number>();
  payments.forEach(payment => {
    const id = String(payment.cashHolderId);
    requestedByHolder.set(id, (requestedByHolder.get(id) || 0) + (Number(payment.amount) || 0));
  });
  for (const holder of holders) {
    const id = String(holder.userId);
    const available = (Number(holder.currentBalance) || 0) + (restoredByHolder.get(id) || 0);
    if ((requestedByHolder.get(id) || 0) - available > 0.01) {
      return `رصيد العهدة غير كافٍ لدى صاحب العهدة (${id}).`;
    }
  }
  return null;
};

export const applyCustodyPayments = <T extends CustodyHolderLike>(
  holders: T[],
  payments: CustodyPaymentLike[],
  direction: 'deduct' | 'restore'
): T[] => {
  const sign = direction === 'deduct' ? -1 : 1;
  const byHolder = new Map<string, number>();
  payments.forEach(payment => {
    const id = String(payment.cashHolderId);
    byHolder.set(id, (byHolder.get(id) || 0) + (Number(payment.amount) || 0));
  });
  return holders.map(holder => {
    const amount = byHolder.get(String(holder.userId));
    return amount === undefined ? holder : { ...holder, currentBalance: (Number(holder.currentBalance) || 0) + sign * amount };
  });
};

export const createCustodyLedgerDetails = (input: Omit<CustodyLedgerDetails, 'schemaVersion' | 'entryType' | 'recordedAt'> & { recordedAt?: string }): CustodyLedgerDetails => ({
  schemaVersion: 1,
  entryType: 'custody_ledger',
  recordedAt: input.recordedAt || new Date().toISOString(),
  ...input
});

export const getCustodyLedgerDetails = (entry: { details?: unknown }): CustodyLedgerDetails | null => {
  const raw = entry?.details;
  const details = typeof raw === 'string' ? (() => {
    try { return JSON.parse(raw); } catch { return null; }
  })() : raw;
  if (!details || typeof details !== 'object' || (details as any).entryType !== 'custody_ledger') return null;
  return details as CustodyLedgerDetails;
};

/**
 * Returns a stable source key for a custody movement generated from an order.
 * The order id is preferred; the visible order number is a safe fallback for
 * legacy records that were saved before orderId was persisted.
 */
export const getCustodySourceKey = (source: Pick<CustodySource, 'orderId' | 'orderNumber'> | CustodyLedgerEntryLike): string => {
  const candidate = source as CustodyLedgerEntryLike & Partial<CustodySource>;
  const orderId = clean(candidate.orderId) || clean(candidate.order_id);
  if (orderId) return `order:${orderId}`;

  const orderNumber = clean(candidate.orderNumber) || clean(candidate.order_number);
  if (orderNumber) return `order-number:${orderNumber.replace(/^#/, '')}`;

  const notes = clean(candidate.notes);
  const match = notes.match(/(?:طلب|order)\s*#?\s*([\w-]+)/i);
  return match?.[1] ? `order-number:${match[1]}` : '';
};

const getKind = (entry: CustodyLedgerEntryLike): CustodySource['kind'] | '' => {
  const notes = clean(entry.notes).toLowerCase();
  if (notes.includes('عربون') || notes.includes('دفع مقدم') || notes.includes('advance')) return 'advance';
  if (notes.includes('كاشير') || notes.includes('pos')) return 'pos_collection';
  return '';
};

/**
 * Detects whether an order-generated custody movement already exists in the
 * persisted handover ledger. This is intentionally source-based rather than
 * amount-based, so a single order cannot create duplicate virtual movements
 * when its displayed amount or recipient changes.
 */
export const hasMatchingCustodySource = (entries: CustodyLedgerEntryLike[], source: CustodySource): boolean => {
  const sourceKey = getCustodySourceKey(source);
  if (!sourceKey) return false;
  const legacySourceKey = clean(source.orderNumber)
    ? `order-number:${clean(source.orderNumber).replace(/^#/, '')}`
    : '';

  return entries.some((entry) => {
    const entryKey = getCustodySourceKey(entry);
    if (entryKey !== sourceKey && entryKey !== legacySourceKey) return false;
    const kind = getKind(entry);
    return kind === source.kind;
  });
};

export const getVirtualCustodyEntryId = (orderId?: string | number | null, orderNumber?: string | number | null): string => {
  const source = clean(orderId) || clean(orderNumber) || 'unknown';
  return `virtual-custody-order-${source}`;
};
