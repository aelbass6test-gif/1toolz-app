import { UploadedSheetFile, ZoneRateConfig } from './codReconciliation';

export interface BankConfirmationRecord {
  cashoutId: string;
  confirmedAt: string;
  amount: number;
  note?: string;
}

export type WalletEntryKind =
  | 'goods_cost'
  | 'ads'
  | 'operating_expense'
  | 'supplier_payment'
  | 'partner_withdrawal'
  | 'personal_withdrawal'
  | 'extra_income'
  | 'opening_balance';

export interface WalletLedgerEntry {
  id: string;
  date: string;
  kind: WalletEntryKind;
  direction: 'in' | 'out';
  amount: number;
  brandName?: string;
  note: string;
  createdAt: string;
}

export type WalletCalculationMode = 'verified_only' | 'full_sheets';
export type WalletDataScope = 'orders_period' | 'full_transactions';

export interface WalletCostConfig {
  calculationMode?: WalletCalculationMode;
  dataScope?: WalletDataScope;
  useAutoCogsFromOrders: boolean;
  includeStoreExpensesFromWallet: boolean;
  includeTreasuryBalances: boolean;
  deductEstimatedShippingOnDeliveriesOnly?: boolean;
}

export interface PersistedCodHunterState {
  storeId: string;
  uploadedFiles: UploadedSheetFile[];
  bankConfirmedCashouts: Record<string, BankConfirmationRecord>;
  manualMatches: Record<string, string>;
  manualCreditTrackingMap?: Record<string, string>;
  walletLedgerEntries?: WalletLedgerEntry[];
  walletCostConfig?: WalletCostConfig;
  maxExpectedShippingFee: number;
  zoneRates?: ZoneRateConfig;
  matchWithStoreOrders: boolean;
  enableProductPriceAudit?: boolean;
  productPriceAuditSource?: 'hybrid' | 'inventory_only' | 'sheet_median';
  sheetBrandFilter: string;
  updatedAt: string;
}

const DB_NAME = 'bosta_cod_hunter_db';
const DB_VERSION = 1;
const STORE_NAME = 'workspace_state';
const LS_META_PREFIX = 'cod_hunter_meta_v1_';

function openCodDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'storeId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

export async function saveCodHunterState(state: PersistedCodHunterState): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const db = await openCodDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(state);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('IndexedDB write failed'));
      };
    });
  } catch {
    // Fallback: persist lightweight settings/confirmations in localStorage if IndexedDB blocked
  }

  try {
    const lightState: Omit<PersistedCodHunterState, 'uploadedFiles'> = {
      storeId: state.storeId,
      bankConfirmedCashouts: state.bankConfirmedCashouts,
      manualMatches: state.manualMatches,
      manualCreditTrackingMap: state.manualCreditTrackingMap || {},
      walletLedgerEntries: state.walletLedgerEntries || [],
      walletCostConfig: state.walletCostConfig,
      maxExpectedShippingFee: state.maxExpectedShippingFee,
      zoneRates: state.zoneRates,
      matchWithStoreOrders: state.matchWithStoreOrders,
      enableProductPriceAudit: state.enableProductPriceAudit,
      productPriceAuditSource: state.productPriceAuditSource,
      sheetBrandFilter: state.sheetBrandFilter,
      updatedAt: state.updatedAt
    };
    window.localStorage.setItem(`${LS_META_PREFIX}${state.storeId}`, JSON.stringify(lightState));
  } catch {
    // Ignore storage quota errors
  }
}

export async function loadCodHunterState(
  storeId: string
): Promise<PersistedCodHunterState | null> {
  if (typeof window === 'undefined' || !storeId) return null;
  try {
    const db = await openCodDb();
    const record = await new Promise<PersistedCodHunterState | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(storeId);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as PersistedCodHunterState | undefined) || null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error || new Error('IndexedDB read failed'));
      };
    });
    if (record) return record;
  } catch {
    // Fall through to localStorage fallback
  }

  try {
    const raw = window.localStorage.getItem(`${LS_META_PREFIX}${storeId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedCodHunterState>;
    return {
      storeId,
      uploadedFiles: [],
      bankConfirmedCashouts: parsed.bankConfirmedCashouts || {},
      manualMatches: parsed.manualMatches || {},
      manualCreditTrackingMap: parsed.manualCreditTrackingMap || {},
      walletLedgerEntries: Array.isArray(parsed.walletLedgerEntries) ? parsed.walletLedgerEntries : [],
      walletCostConfig: parsed.walletCostConfig,
      maxExpectedShippingFee:
        typeof parsed.maxExpectedShippingFee === 'number' ? parsed.maxExpectedShippingFee : 110,
      zoneRates: parsed.zoneRates,
      matchWithStoreOrders:
        typeof parsed.matchWithStoreOrders === 'boolean' ? parsed.matchWithStoreOrders : true,
      enableProductPriceAudit:
        typeof parsed.enableProductPriceAudit === 'boolean' ? parsed.enableProductPriceAudit : true,
      productPriceAuditSource: parsed.productPriceAuditSource || 'hybrid',
      sheetBrandFilter: parsed.sheetBrandFilter || 'all',
      updatedAt: parsed.updatedAt || ''
    };
  } catch {
    return null;
  }
}

export async function clearCodHunterFiles(storeId: string): Promise<void> {
  if (typeof window === 'undefined' || !storeId) return;
  try {
    const existing = await loadCodHunterState(storeId);
    if (existing) {
      await saveCodHunterState({
        ...existing,
        uploadedFiles: [],
        updatedAt: new Date().toISOString()
      });
    }
  } catch {
    // Ignore
  }
}
