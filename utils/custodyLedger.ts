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
