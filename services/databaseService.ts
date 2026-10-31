import { db as localDb } from '../src/lib/db';
import { createClient } from '@supabase/supabase-js';
import { db as firebaseDb, auth } from './firebaseClient';
import { 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    updateDoc,
    deleteDoc, 
    query, 
    where, 
    onSnapshot,
    runTransaction,
    setLogLevel
} from 'firebase/firestore';

let isFirestoreQuotaExhausted = false;

export const markFirestoreQuotaExhausted = () => {
    isFirestoreQuotaExhausted = true;
    try { setLogLevel('error'); } catch (_) {}
};

export const getIsFirestoreQuotaExhausted = () => isFirestoreQuotaExhausted;
import { 
    Store, 
    StoreData, 
    User, 
    Product, 
    Order, 
    Transaction, 
    Supplier, 
    SupplyOrder, 
    Review, 
    AbandonedCart, 
    ActivityLog, 
    Employee, 
    DiscountCode, 
    Collection, 
    CustomPage, 
    PaymentMethod, 
    CustomerProfile, 
    GlobalOption, 
    ShippingCarrierIntegration,
    Treasury,
    TreasuryAccount,
    TreasuryTransaction,
    Partner,
    PartnerTransaction,
    Warehouse,
    InventoryAuditSession,
    StockTransfer,
    OrderReturn,
    PurchaseReturn,
    POSSale,
    CashHolder,
    CashHandover,
    WhatsAppTemplate,
    CallScript
} from '../types';
import { INITIAL_SETTINGS } from '../constants';
import {
    shouldDeleteCloudRecord,
    evaluateRecordUpsert,
    reconcileDualOrderSources,
    SaveStoreDataResult,
    generateUniqueOrderId
} from '../utils/syncIntegrity';
import { normalizeMerchantLabel, isDummyMockSupplier, sanitizeSuppliersList } from '../utils/merchantProducts';

const LOCAL_STORAGE_PREFIX = 'wuilt_backup_';

// --- Supabase Custom Connection ---
let supabaseSingleton: any = null;
const syncFingerprints = new Map<string, string>();

const defaultMissingColumns = [
    'partners:email',
    'partners:passcode',
    'partners:password',
    'partners:requireEmailOtp',
    'partners:require_email_otp',
    'partners:isEmailVerified',
    'partners:is_email_verified',
    'partners:emailVerifiedAt',
    'partners:email_verified_at',
    'partners:lastLoginAt',
    'partners:last_login_at',
    'partners:employeeId',
    'partners:employee_id',
    'partners:permissions',
    'partners:portalPermissions',
    'partners:payoutAccounts',
    'partners:subscriptionPlan',
    'partners:managerPlan',
    'suppliers:email',
    'suppliers:passcode',
    'suppliers:transactions',
    'suppliers:profitRatio',
    'suppliers:profit_ratio',
    'suppliers:role',
    'suppliers:payoutAccounts',
    'suppliers:subscriptionPlan',
    'suppliers:managerPlan'
];
let storedMissingCols: string[] = [];
try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('supabase_missing_columns') : null;
    if (raw) storedMissingCols = JSON.parse(raw);
} catch (e) {}

const knownMissingColumns = new Set<string>([...defaultMissingColumns, ...storedMissingCols]);

let storedMissingTables: string[] = [];
try {
    const rawTables = typeof window !== 'undefined' ? localStorage.getItem('supabase_missing_tables') : null;
    if (rawTables) storedMissingTables = JSON.parse(rawTables);
} catch (e) {}

const knownMissingTables = new Set<string>(['quotations', ...storedMissingTables]);

export const syncSupabaseCredentials = (storeId: string, settings: any) => {
    if (typeof window === 'undefined') return;
    const activeStoreId = localStorage.getItem('lastActiveStoreId');
    if (!activeStoreId || activeStoreId === storeId) {
        const localUrl = localStorage.getItem('custom_cloud_url');
        const localKey = localStorage.getItem('custom_cloud_anon_key');
        
        if (settings) {
            if (settings.supabaseUrl && settings.supabaseAnonKey) {
                if (localUrl !== settings.supabaseUrl || localKey !== settings.supabaseAnonKey) {
                    console.log(`[SUPABASE-SYNC] Syncing custom cloud credentials for store ${storeId} to localStorage...`);
                    localStorage.setItem('custom_cloud_url', settings.supabaseUrl);
                    localStorage.setItem('custom_cloud_anon_key', settings.supabaseAnonKey);
                }
            } else if (localUrl && localKey) {
                // If localStorage already has credentials, attach them to settings object so it persists
                console.log(`[SUPABASE-SYNC] Attaching stored custom cloud credentials to store settings...`);
                settings.supabaseUrl = localUrl;
                settings.supabaseAnonKey = localKey;
            }
        }
    }
};

export const getSupabaseClient = () => {
    if (typeof window === 'undefined') return null;
    const provider = localStorage.getItem('custom_cloud_provider');
    if (provider === 'firebase' || provider === 'hostinger') return null;
    if (getSupabaseRestrictedStatus()) return null;

    const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
    const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
    const url = localStorage.getItem('custom_cloud_url') || envUrl;
    const key = localStorage.getItem('custom_cloud_anon_key') || envKey;
    
    if (url && key && url.startsWith('http')) {
        // Reuse existing client if credentials haven't changed
        if (supabaseSingleton && supabaseSingleton.__url === url && supabaseSingleton.__key === key) {
            return supabaseSingleton;
        }
        try {
            const client = createClient(url, key);
            // Attach URL/Key for comparison in next calls
            (client as any).__url = url;
            (client as any).__key = key;
            supabaseSingleton = client;
            return supabaseSingleton;
        } catch (e) {
            console.error('Failed to init custom Supabase client', e);
            return null;
        }
    }
    supabaseSingleton = null;
    return null;
};

export const isSupabaseActive = (): boolean => {
    if (typeof window !== 'undefined') {
        const provider = localStorage.getItem('custom_cloud_provider');
        if (provider === 'firebase' || provider === 'hostinger') return false;
        if (getSupabaseRestrictedStatus()) return false;
    }
    const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
    const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
    const hasUrl = !!(typeof window !== 'undefined' ? localStorage.getItem('custom_cloud_url') : '') || !!envUrl;
    const hasKey = !!(typeof window !== 'undefined' ? localStorage.getItem('custom_cloud_anon_key') : '') || !!envKey;
    return hasUrl && hasKey;
};

/**
 * Pings the Supabase endpoint to verify credentials
 */
export const verifySupabaseConnection = async (url: string, key: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const client = createClient(url, key);
        // Try to select from a common table or just a health check
        // Note: Even if table doesn't exist, if we get a 404 or something from the client
        // it means we reached the server. A 401/403 means bad key.
        const { error } = await client.from('stores_data').select('id').limit(1);
        
        if (error) {
            // If the table doesn't exist yet, it's still a success in terms of CONNECTION (the key/url are valid)
            if (error.code === 'PGRST116' || error.message.includes('relation "stores_data" does not exist')) {
                return { success: true };
            }
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};

// --- Hostinger MySQL Support ---

export const isHostingerActive = (): boolean => {
  return typeof window !== 'undefined'
    && window.localStorage?.getItem('custom_cloud_provider') === 'hostinger';
};

export const verifyHostingerConnection = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const res = await fetch('/api/mysql/status');
    const data = await res.json();
    if (data.active) return { success: true };
    return { success: false, error: 'MySQL is not configured in backend .env' };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};

// --- Error Handling & Metrics ---
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export const handleFirestoreError = (err: any, operation: OperationType, path: string) => {
    const msg = String(err?.message || err);
    if (msg.includes('quota') || msg.includes('resource-exhausted') || (err as any)?.code === 'resource-exhausted') {
        markFirestoreQuotaExhausted();
    }
    const errInfo = {
        error: err instanceof Error ? err.message : String(err),
        operationType: operation,
        path,
        authInfo: {
            userId: auth?.currentUser?.uid || null,
            email: auth?.currentUser?.email || null,
            emailVerified: auth?.currentUser?.emailVerified ?? null,
            isAnonymous: auth?.currentUser?.isAnonymous ?? null,
            tenantId: auth?.currentUser?.tenantId || null,
            providerInfo: auth?.currentUser?.providerData?.map(provider => ({
                providerId: provider.providerId,
                email: provider.email
            })) || []
        }
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
};

export interface DatabaseErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
  }
}

function handleDatabaseError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  
  const errInfo: DatabaseErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: typeof window !== 'undefined' ? localStorage.getItem('currentUserPhone') : null,
    },
    operationType,
    path
  };
  console.error('Database Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function cleanUndefined<T>(obj: T): T {
    if (obj === null || obj === undefined) {
        return null as any;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => cleanUndefined(item)) as any;
    }
    if (typeof obj === 'object') {
        const result: any = {};
        for (const key of Object.keys(obj)) {
            const val = (obj as any)[key];
            if (val !== undefined) {
                result[key] = cleanUndefined(val);
            }
        }
        return result;
    }
    return obj;
}

export const checkSupabaseConnection = async (): Promise<boolean> => {
    try {
        const supabase = getSupabaseClient();
        if (supabase) {
            const { error } = await supabase.from('stores_data').select('id').limit(1);
            return !error;
        }
        return false;
    } catch (error: any) {
        return false;
    }
};

export const getSupabaseRestrictedStatus = (): boolean => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('supabase_restricted') === 'true';
};

export const setSupabaseRestricted = (restricted: boolean) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('supabase_restricted', String(restricted));
    if (restricted) {
        localStorage.setItem('custom_cloud_provider', 'firebase');
    }
    window.dispatchEvent(new CustomEvent('supabase_restricted_changed', { detail: { restricted } }));
};

export const isRestrictionError = (error: any): boolean => {
    if (!error) return false;
    const msg = String(error?.message || error?.details || error?.hint || error || '').toLowerCase();
    const code = String(error?.code || '').toLowerCase();
    const status = Number(error?.status || 0);
    return (
        msg.includes('exceed_egress_quota') ||
        msg.includes('egress_quota') ||
        msg.includes('spend caps') ||
        msg.includes('violations') ||
        msg.includes('upgrade their plan') ||
        msg.includes('quota') ||
        msg.includes('restricted') ||
        msg.includes('permission') ||
        msg.includes('access') ||
        msg.includes('unauthorized') ||
        msg.includes('rate limit') ||
        msg.includes('resource-exhausted') ||
        status === 402 ||
        status === 429 ||
        code === '402' ||
        code === '429'
    );
};

// --- Local IndexedDB Helpers ---
export const getLocal = async (key: string): Promise<any> => {
    try {
        if (key === 'global') {
            const settings = await localDb.settings.get('global') as any;
            if (settings?.data) return settings.data;
            // Fallback to localStorage for emergency
            const backup = localStorage.getItem('emergency_global_backup');
            if (backup) return JSON.parse(backup);
            return null;
        }
        
        const orders = await localDb.orders.where('store_id').equals(key).toArray();
        const settingsRecord = await localDb.settings.get(key) as any;
        const wallet = await localDb.wallet.get(key);
        const treasury = await localDb.treasury.get(key);
        const customers = await localDb.customers.where('store_id').equals(key).toArray();

        // 1. Fetch quotations from IndexedDB
        let quotations: any[] = [];
        try {
            if (localDb.quotations) {
                quotations = await localDb.quotations.where('store_id').equals(key).toArray();
            }
        } catch (qErr) {
            console.warn('[DB] Could not read quotations from IndexedDB:', qErr);
        }

        // 2. Fallback: If quotations empty, attempt restore from backups
        if (!quotations || quotations.length === 0) {
            try {
                const qDirect = localStorage.getItem(`quotations_backup_${key}`);
                if (qDirect) {
                    quotations = JSON.parse(qDirect);
                } else {
                    const backup = localStorage.getItem(`emergency_store_backup_${key}`);
                    if (backup) {
                        const parsed = JSON.parse(backup);
                        if (parsed.quotations && Array.isArray(parsed.quotations) && parsed.quotations.length > 0) {
                            quotations = parsed.quotations;
                        }
                    }
                }
            } catch (backupErr) {
                console.warn('[DB] Backup quotations read error:', backupErr);
            }
        }

        // 3. Self-healing: If any orders exist that were converted from a quotation, restore them if missing!
        if (orders && orders.length > 0) {
            const existingQNumbers = new Set((quotations || []).map((q: any) => q.quotationNumber));
            const reconstructedQuotations: any[] = [];

            for (const ord of orders) {
                if (ord.quotationNumber && !existingQNumbers.has(ord.quotationNumber)) {
                    existingQNumbers.add(ord.quotationNumber);
                    reconstructedQuotations.push({
                        id: `qt_restored_${ord.id}`,
                        quotationNumber: ord.quotationNumber,
                        createdAt: ord.createdAt || ord.date || new Date().toISOString(),
                        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                        status: 'محول_لطلب_شحن',
                        customerName: ord.customerName || '',
                        customerPhone: ord.customerPhone || '',
                        customerPhone2: ord.customerPhone2 || '',
                        customerEmail: ord.customerEmail || '',
                        customerAddress: ord.customerAddress || '',
                        customerCity: ord.customerCity || '',
                        items: ord.items || [],
                        subtotal: ord.productPrice || ord.totalPrice || 0,
                        discount: 0,
                        shippingFee: ord.shippingFee || 0,
                        total: ord.totalPrice || 0,
                        advancePayment: (ord.paymentMethod?.includes('مدفوع') || ord.totalAmountOverride === 0) ? (ord.totalPrice || 0) : 0,
                        remainingAmount: ord.totalAmountOverride !== undefined ? ord.totalAmountOverride : (ord.totalPrice || 0),
                        shippingCompany: ord.shippingCompany || '',
                        convertedOrderId: ord.id,
                        convertedOrderNumber: ord.orderNumber,
                        convertedAt: ord.date || ord.createdAt,
                        notes: ord.notes || 'مسترجع تلقائياً من طلب الشحن المحول',
                        terms: '',
                        createdBy: (ord as any).salesEmployee || ord.assignedEmployeeId || 'المبيعات'
                    });
                }
            }

            if (reconstructedQuotations.length > 0) {
                quotations = [...(quotations || []), ...reconstructedQuotations];
                try {
                    if (localDb.quotations) {
                        const qWithId = quotations.map((q: any) => ({ ...q, store_id: key }));
                        await localDb.quotations.bulkPut(qWithId);
                    }
                } catch (persistErr) {
                    console.warn('[DB] Failed saving reconstructed quotations to Dexie:', persistErr);
                }
            }
        }

        // If there's no settings in IndexedDB and no orders, we don't have this store locally at all.
        if (!settingsRecord && (!orders || orders.length === 0)) {
            // Check emergency fallback first
            const backup = localStorage.getItem(`emergency_store_backup_${key}`);
            if (backup) return JSON.parse(backup);
            return null;
        }

        // Safe fetch settings, fallback to INITIAL_SETTINGS if store was created but settings lost
        const settings = settingsRecord?.data || { ...INITIAL_SETTINGS };

        syncSupabaseCredentials(key, settings);

        const result = {
            orders: orders || [],
            settings: settings,
            wallet: wallet || { balance: 0, transactions: [] },
            treasury: treasury,
            cart: [],
            customers: customers || [],
            quotations: quotations || []
        };

        return result;
    } catch (e) {
        console.error('IndexedDB read error', e);
        // Emergency fallback from localStorage
        const backup = localStorage.getItem(`emergency_store_backup_${key}`);
        if (backup) return JSON.parse(backup);
        return null;
    }
};

export const saveLocal = async (key: string, data: any) => {
    try {
        if (key === 'global') {
            await localDb.settings.put({ id: 'global', data } as any);
            try {
                const leanGlobal = {
                    ...data,
                    users: (data.users || []).map((u: any) => ({
                        ...u,
                        stores: (u.stores || []).map((s: any) => ({
                            ...s,
                            logo: typeof s.logo === 'string' && s.logo.length > 500 ? '' : s.logo
                        }))
                    }))
                };
                localStorage.setItem('emergency_global_backup', JSON.stringify(leanGlobal));
            } catch (storageErr) {
                // Quota safely handled; Dexie handles primary persistence
            }
            return;
        }

        const storeId = key;
        
        if (data.orders) {
            const ordersWithId = data.orders.map((o: any) => ({ ...o, store_id: storeId }));
            await localDb.orders.where('store_id').equals(storeId).delete();
            if (ordersWithId.length > 0) {
                await localDb.orders.bulkPut(ordersWithId);
            }
        }

        if (data.settings) {
            await localDb.settings.put({ id: storeId, data: data.settings } as any);
            syncSupabaseCredentials(storeId, data.settings);
        }

        if (data.wallet) {
            await localDb.wallet.put({ ...data.wallet, id: storeId });
        }

        if (data.treasury) {
            await localDb.treasury.put({ ...data.treasury, id: storeId });
        }

        if (data.customers) {
            const customersWithId = data.customers.map((c: any) => ({ ...c, store_id: storeId }));
            await localDb.customers.bulkPut(customersWithId);
        }

        if (data.quotations) {
            try {
                if (localDb.quotations) {
                    const quotationsWithId = data.quotations.map((q: any) => ({ ...q, store_id: storeId }));
                    await localDb.quotations.where('store_id').equals(storeId).delete();
                    if (quotationsWithId.length > 0) {
                        await localDb.quotations.bulkPut(quotationsWithId);
                    }
                }
            } catch (qErr) {
                console.warn('[DB] Failed saving quotations to IndexedDB:', qErr);
            }
            try {
                localStorage.setItem(`quotations_backup_${key}`, JSON.stringify(data.quotations));
            } catch (storageErr) {
                // Ignore storage quota
            }
        }
        
        // Lean emergency backup to localStorage (strip heavy base64 to avoid localStorage 5MB quota limit)
        try {
            const leanStoreData = {
                ...data,
                quotations: data.quotations || [],
                settings: {
                    ...data.settings,
                    products: (data.settings?.products || []).map((p: any) => {
                        const thumb = typeof p.thumbnail === 'string' && p.thumbnail.startsWith('data:') && p.thumbnail.length > 1000 ? '' : (p.thumbnail || (Array.isArray(p.images) && p.images[0]) || '');
                        const cleanImgs = Array.isArray(p.images) 
                            ? p.images.filter((img: string) => typeof img === 'string' && (!img.startsWith('data:') || img.length <= 1000))
                            : (thumb ? [thumb] : []);
                        return {
                            ...p,
                            thumbnail: thumb,
                            images: cleanImgs
                        };
                    })
                }
            };
            localStorage.setItem(`emergency_store_backup_${key}`, JSON.stringify(leanStoreData));
        } catch (storageErr) {
            // Quota safely handled; Dexie handles primary persistence
        }
    } catch (e) {
        console.warn(`IndexedDB backup failed for key '${key}'.`, e);
    }
};

// --- Utils ---
export const WITH_TIMEOUT = <T>(promise: Promise<T>, timeoutMs: number = 5000): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('العملية السحابية استغرقت وقتاً طويلاً')), timeoutMs))
    ]);
};

// --- Sync Optimizations: Memory-Hash Cache & ID Tracking to Prevent Duplicate Firestore Reads/Writes & Accidental Deletions ---
const loadInitialSyncedHashes = (): Record<string, string> => {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const raw = localStorage.getItem('last_synced_hashes');
            if (raw) return JSON.parse(raw);
        }
    } catch (_) {}
    return {};
};

const LAST_SYNCED_HASHES = loadInitialSyncedHashes();
const LAST_KNOWN_DOC_IDS: Record<string, Set<string>> = {};

const saveSyncedHashes = () => {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem('last_synced_hashes', JSON.stringify(LAST_SYNCED_HASHES));
        }
    } catch (_) {}
};

const loadInitialDeletedIds = (): Set<string> => {
    const s = new Set<string>();
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const raw = localStorage.getItem('explicit_deleted_ids');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    parsed.forEach(id => s.add(String(id)));
                }
            }
        }
    } catch (_) {}
    return s;
};

const EXPLICIT_DELETED_IDS = loadInitialDeletedIds();

export const isExplicitlyDeleted = (id: string, storeId?: string): boolean => {
    if (!id) return false;
    const rawId = String(id).trim();
    if (EXPLICIT_DELETED_IDS.has(rawId)) return true;
    if (storeId) {
        if (EXPLICIT_DELETED_IDS.has(`${storeId}_${rawId}`)) return true;
        if (EXPLICIT_DELETED_IDS.has(`${storeId}_orders_${rawId}`)) return true;
        if (EXPLICIT_DELETED_IDS.has(`${storeId}_suppliers_${rawId}`)) return true;
        if (EXPLICIT_DELETED_IDS.has(`${storeId}_partners_${rawId}`)) return true;
    }
    try {
        const raw = localStorage.getItem('explicit_deleted_ids');
        if (raw && (raw.includes(`"${rawId}"`) || raw.includes(`"${storeId}_${rawId}"`) || raw.includes(`"${storeId}_orders_${rawId}"`))) {
            EXPLICIT_DELETED_IDS.add(rawId);
            return true;
        }
    } catch (_) {}
    return false;
};

const recordExplicitDeletion = (key: string) => {
    EXPLICIT_DELETED_IDS.add(key);
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const arr = Array.from(EXPLICIT_DELETED_IDS).slice(-3000);
            localStorage.setItem('explicit_deleted_ids', JSON.stringify(arr));
        }
    } catch (_) {}
};

/**
 * Safely delete an item from a store collection in Firestore and Supabase.
 * Deeply purges the item from collection docs, stores_data arrays, and local cache
 * to ensure complete permanent deletion ("من جذوره") with zero accidental resurrection.
 */
export const deleteStoreItem = async (storeId: string, collectionName: string, itemId: string): Promise<boolean> => {
    try {
        const rawId = String(itemId);
        const docId = rawId.startsWith(storeId + '_') ? rawId : `${storeId}_${rawId}`;
        recordExplicitDeletion(`${storeId}_${collectionName}_${docId}`);
        recordExplicitDeletion(`${storeId}_${collectionName}_${rawId}`);
        recordExplicitDeletion(`${storeId}_${docId}`);
        recordExplicitDeletion(`${storeId}_${rawId}`);
        recordExplicitDeletion(docId);
        recordExplicitDeletion(rawId);

        const hashKey = `${storeId}_${collectionName}`;
        if (LAST_KNOWN_DOC_IDS[hashKey]) {
            LAST_KNOWN_DOC_IDS[hashKey].delete(docId);
            LAST_KNOWN_DOC_IDS[hashKey].delete(rawId);
        }
        delete LAST_SYNCED_HASHES[hashKey];

        const supabase = getSupabaseClient();
        if (supabase) {
            try {
                await supabase.from(collectionName).delete().or(`id.eq.${docId},id.eq.${rawId}`);
                if (collectionName === 'orders') {
                    await supabase.from('orders').delete().or(`order_number.eq.${rawId},orderNumber.eq.${rawId}`);
                }
            } catch (_) {}
        }

        if (firebaseDb) {
            const docRef = doc(firebaseDb, collectionName, docId);
            await deleteDoc(docRef).catch(() => {});

            if (docId !== rawId) {
                const rawDocRef = doc(firebaseDb, collectionName, rawId);
                await deleteDoc(rawDocRef).catch(() => {});
            }

            // CRITICAL: If deleting an order, purge it from the stores_data embedded array as well!
            if (collectionName === 'orders') {
                const storeDocRef = doc(firebaseDb, 'stores_data', storeId);
                getDoc(storeDocRef).then(snap => {
                    if (snap.exists()) {
                        const sData = snap.data();
                        if (Array.isArray(sData?.orders)) {
                            const filteredOrders = sData.orders.filter((o: any) => {
                                const oId = String(o?.id || '');
                                const oNum = String(o?.orderNumber || '');
                                return oId !== rawId && oId !== docId && oNum !== rawId && oNum !== docId;
                            });
                            if (filteredOrders.length !== sData.orders.length) {
                                updateDoc(storeDocRef, { orders: filteredOrders }).catch(() => {});
                            }
                        }
                    }
                }).catch(() => {});
            }

            // CRITICAL: If deleting a supplier or partner, purge from stores_data settings & embedded arrays
            if (collectionName === 'suppliers' || collectionName === 'partners') {
                const storeDocRef = doc(firebaseDb, 'stores_data', storeId);
                getDoc(storeDocRef).then(snap => {
                    if (snap.exists()) {
                        const sData = snap.data();
                        const sSettings = sData?.settings || {};
                        let updated = false;
                        const newPayload: any = {};

                        if (collectionName === 'suppliers') {
                            if (Array.isArray(sData?.suppliers)) {
                                const filtered = sData.suppliers.filter((s: any) => String(s?.id || '') !== rawId && String(s?.id || '') !== docId);
                                if (filtered.length !== sData.suppliers.length) {
                                    newPayload.suppliers = filtered;
                                    updated = true;
                                }
                            }
                            if (Array.isArray(sSettings?.suppliers)) {
                                const filtered = sSettings.suppliers.filter((s: any) => String(s?.id || '') !== rawId && String(s?.id || '') !== docId);
                                if (filtered.length !== sSettings.suppliers.length) {
                                    newPayload.settings = { ...(newPayload.settings || sSettings), suppliers: filtered };
                                    updated = true;
                                }
                            }
                        }

                        if (collectionName === 'partners') {
                            if (Array.isArray(sData?.partners)) {
                                const filtered = sData.partners.filter((p: any) => String(p?.id || '') !== rawId && String(p?.id || '') !== docId);
                                if (filtered.length !== sData.partners.length) {
                                    newPayload.partners = filtered;
                                    updated = true;
                                }
                            }
                            if (Array.isArray(sSettings?.partners)) {
                                const filtered = sSettings.partners.filter((p: any) => String(p?.id || '') !== rawId && String(p?.id || '') !== docId);
                                if (filtered.length !== sSettings.partners.length) {
                                    newPayload.settings = { ...(newPayload.settings || sSettings), partners: filtered };
                                    updated = true;
                                }
                            }
                        }

                        if (updated) {
                            updateDoc(storeDocRef, newPayload).catch(() => {});
                        }
                    }
                }).catch(() => {});
            }
        }

        // Immediately update localStorage so offline/memory caches never resurrect it
        if (collectionName === 'orders') {
            getLocal(storeId).then(localData => {
                if (localData && Array.isArray(localData.orders)) {
                    const beforeCount = localData.orders.length;
                    localData.orders = localData.orders.filter((o: any) => {
                        const oId = String(o?.id || '');
                        const oNum = String(o?.orderNumber || '');
                        return oId !== rawId && oId !== docId && oNum !== rawId && oNum !== docId;
                    });
                    if (localData.orders.length !== beforeCount) {
                        saveLocal(storeId, localData).catch(() => {});
                    }
                }
            }).catch(() => {});
        }

        if (collectionName === 'suppliers' || collectionName === 'partners') {
            getLocal(storeId).then(localData => {
                if (localData) {
                    let changed = false;
                    if (collectionName === 'suppliers') {
                        if (Array.isArray(localData.settings?.suppliers)) {
                            const before = localData.settings.suppliers.length;
                            localData.settings.suppliers = localData.settings.suppliers.filter((s: any) => String(s?.id || '') !== rawId && String(s?.id || '') !== docId);
                            if (localData.settings.suppliers.length !== before) changed = true;
                        }
                        if (Array.isArray(localData.suppliers)) {
                            const before = localData.suppliers.length;
                            localData.suppliers = localData.suppliers.filter((s: any) => String(s?.id || '') !== rawId && String(s?.id || '') !== docId);
                            if (localData.suppliers.length !== before) changed = true;
                        }
                    }
                    if (collectionName === 'partners') {
                        if (Array.isArray(localData.settings?.partners)) {
                            const before = localData.settings.partners.length;
                            localData.settings.partners = localData.settings.partners.filter((p: any) => String(p?.id || '') !== rawId && String(p?.id || '') !== docId);
                            if (localData.settings.partners.length !== before) changed = true;
                        }
                        if (Array.isArray(localData.partners)) {
                            const before = localData.partners.length;
                            localData.partners = localData.partners.filter((p: any) => String(p?.id || '') !== rawId && String(p?.id || '') !== docId);
                            if (localData.partners.length !== before) changed = true;
                        }
                    }
                    if (changed) {
                        saveLocal(storeId, localData).catch(() => {});
                    }
                }
            }).catch(() => {});
        }

        return true;
    } catch (e) {
        console.error(`[deleteStoreItem] Error deleting item ${itemId} from ${collectionName}:`, e);
        return false;
    }
};

function getCollectionHash(items: any[] | null | undefined): string {
    if (!items || !Array.isArray(items) || items.length === 0) return '[]';
    const stripped = items.map(item => {
        if (!item) return null;
        const { updatedAt, updated_at, _ref, ...rest } = item;
        return rest;
    }).filter(Boolean);
    stripped.sort((a: any, b: any) => {
        const idA = String(a?.id || a?.phone || '');
        const idB = String(b?.id || b?.phone || '');
        return idA.localeCompare(idB);
    });
    return JSON.stringify(stripped);
}

export const ensureStoreRecordExists = async (storeId: string, storeName: string): Promise<{ success: boolean, error?: string }> => {
    try {
        const supabase = getSupabaseClient();
        if (supabase) {
            try {
                await supabase.from('stores_data').upsert({ id: storeId, name: storeName }, { onConflict: 'id' });
            } catch (_) {}
        }
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
};

export const getStoreData = async (storeId: string, forceRemote: boolean = false): Promise<StoreData | null> => {
    // Supabase/remote data must be checked before using a cached snapshot.
    // Keep the local snapshot only as a fallback when remote reads fail.
    const local = await getLocal(storeId);

    // --- Custom Hostinger MySQL Fetch Logic ---
    if (isHostingerActive()) {
      try {
        const fetchTable = async (table: string) => {
          const res = await fetch(`/api/mysql/fetch?table=${table}&storeId=${storeId}`);
          const data = await res.json();
          return data.items || [];
        };

        const [
          products, orders, transactions, treasuryAccounts, treasuryTransactions, suppliers, supplyOrders,
          partners, partnerTransactions, merchantRequests, storeRowResult
        ] = await Promise.all([
          fetchTable('products'),
          fetchTable('orders'),
          fetchTable('transactions'),
          fetchTable('treasury_accounts'),
          fetchTable('treasury_transactions'),
          fetchTable('suppliers'),
          fetchTable('supply_orders'),
          fetchTable('partners'),
          fetchTable('partner_transactions'),
          fetchTable('merchant_requests'),
          fetch(`/api/mysql/fetch?table=stores_data&storeId=${storeId}`).then(r => r.json())
        ]);

        const storeRow = storeRowResult?.items?.[0];
        if (storeRow) {
          const storeSettings = storeRow.settings || {};
          const filteredOrders = (orders || []).filter((o: any) => !isExplicitlyDeleted(o?.id, storeId) && !isExplicitlyDeleted(o?.orderNumber, storeId));
          const fullData: StoreData = {
            settings: { ...INITIAL_SETTINGS, ...storeSettings, products, suppliers, partners, supplyOrders },
            orders: filteredOrders,
            wallet: { balance: storeSettings.wallet_balance || 0, transactions: transactions },
            treasury: { accounts: treasuryAccounts, transactions: treasuryTransactions },
            customers: [], // Will be synced separately if needed
            merchantRequests: merchantRequests || []
          } as any;
          await saveLocal(storeId, fullData);
          return fullData;
        }
      } catch (e) {
        console.warn('[HOSTINGER-FETCH] Failed:', e);
      }
    }

    // --- Custom Supabase Fetch Logic ---
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseActive()) {
        try {
            const fetchTable = async (table: string) => {
                if (knownMissingTables.has(table)) {
                    return [];
                }
                try {
                    const { data, error } = await supabase.from(table).select('*').eq('store_id', storeId);
                    if (error) {
                        if (isRestrictionError(error)) {
                            setSupabaseRestricted(true);
                            throw error;
                        }
                        // Orders are business-critical: never convert a failed read into an empty
                        // list, because the caller would persist that empty list over the local cache.
                        if (table === 'orders') {
                            console.error('[SUPABASE-FETCH] Critical orders read failed; preserving existing data:', error);
                            throw error;
                        }
                        if (error.code === 'PGRST205' || error.code === 'PGRST116') {
                            knownMissingTables.add(table);
                            try {
                                if (typeof window !== 'undefined') {
                                    localStorage.setItem('supabase_missing_tables', JSON.stringify(Array.from(knownMissingTables)));
                                }
                            } catch (e) {}
                            return [];
                        }
                        throw error;
                    }
                    return data || [];
                } catch (fetchErr: any) {
                    if (isRestrictionError(fetchErr)) {
                        setSupabaseRestricted(true);
                        throw fetchErr;
                    }
                    console.warn(`[SUPABASE-FETCH] Could not fetch ${table}:`, fetchErr?.message || fetchErr);
                    if (table === 'orders') throw fetchErr;
                    return [];
                }
            };

            const [
                products, orders, transactions, treasuryAccounts, treasuryTransactions, suppliers, supplyOrders, reviews, abandonedCarts, 
                activityLogs, employees, discountCodes, collectionsList, customPages, 
                paymentMethods, customers, globalOptions, shippingIntegrations, partners, partnerTransactions, chatMessages,
                warehouses, inventoryAudits, stockTransfers, orderReturns, purchaseReturns, posSales, cashHolders, cashHandovers,
                whatsappTemplates, callScripts, quotationsList,
                storeRowResult
            ] = await Promise.all([
                fetchTable('products'),
                fetchTable('orders'),
                fetchTable('transactions'),
                fetchTable('treasury_accounts'),
                fetchTable('treasury_transactions'),
                fetchTable('suppliers'),
                fetchTable('supply_orders'),
                fetchTable('reviews'),
                fetchTable('abandoned_carts'),
                fetchTable('activity_logs'),
                fetchTable('employees'),
                fetchTable('discount_codes'),
                fetchTable('collections'),
                fetchTable('custom_pages'),
                fetchTable('payment_methods'),
                fetchTable('customers'),
                fetchTable('global_options'),
                fetchTable('shipping_integrations'),
                fetchTable('partners'),
                fetchTable('partner_transactions'),
                fetchTable('chat_messages'),
                fetchTable('warehouses'),
                fetchTable('inventory_audits'),
                fetchTable('stock_transfers'),
                fetchTable('order_returns'),
                fetchTable('purchase_returns'),
                fetchTable('pos_sales'),
                fetchTable('cash_holders'),
                fetchTable('cash_handovers'),
                fetchTable('whatsapp_templates'),
                fetchTable('call_scripts'),
                fetchTable('quotations'),
                supabase.from('stores_data').select('*').eq('id', storeId).maybeSingle()
            ]);

            const storeRow = storeRowResult?.data;
            const storeSettings = storeRow?.settings || {};

            const customization = {
                ...(INITIAL_SETTINGS.customization || {}),
                ...(storeSettings.customization || {})
            };
            if (!customization.pageSections || customization.pageSections.length === 0) {
                customization.pageSections = INITIAL_SETTINGS.customization.pageSections;
            }

            const fullData: StoreData = {
                settings: {
                    ...INITIAL_SETTINGS,
                    ...storeSettings,
                    customization,
                    products: (products.length > 0 ? products : (storeSettings.products || local?.settings?.products || [])).map((p: any) => {
                        const details = (p.details && typeof p.details === 'object') ? p.details : {};
                        const localProd = local?.settings?.products?.find((lp: any) => lp.id === p.id);
                        const mergedThumbnail = p.thumbnail || details.thumbnail || localProd?.thumbnail || (Array.isArray(p.images) && p.images[0]) || (Array.isArray(details.images) && details.images[0]) || (localProd?.images && localProd.images[0]) || '';
                        const candidateImages = (Array.isArray(p.images) && p.images.length > 0)
                            ? p.images
                            : (Array.isArray(details.images) && details.images.length > 0)
                                ? details.images
                                : (localProd?.images && localProd.images.length > 0)
                                    ? localProd.images
                                    : (mergedThumbnail ? [mergedThumbnail] : []);
                        return {
                            ...details,
                            ...(localProd || {}),
                            ...p,
                            thumbnail: mergedThumbnail,
                            images: candidateImages
                        };
                    }),
                    suppliers: sanitizeSuppliersList((suppliers.length > 0 ? suppliers : (storeSettings.suppliers || local?.settings?.suppliers || []))).map((s: any) => {
                        const sNameNorm = String(s.name || '').trim().toLowerCase();
                        const fallbackSupplier = (storeSettings.suppliers || []).find((fs: any) => fs.id === s.id || (sNameNorm && String(fs.name || '').trim().toLowerCase() === sNameNorm))
                            || (local?.settings?.suppliers || []).find((ls: any) => ls.id === s.id || (sNameNorm && String(ls.name || '').trim().toLowerCase() === sNameNorm));
                        const details = s.details && typeof s.details === 'object' ? s.details : (typeof s.details === 'string' && s.details ? JSON.parse(s.details) : {});
                        return {
                            ...fallbackSupplier,
                            ...s,
                            email: s.email || details.email || fallbackSupplier?.email || '',
                            passcode: s.passcode || details.passcode || fallbackSupplier?.passcode || '0000',
                            payoutAccounts: s.payoutAccounts || details.payoutAccounts || fallbackSupplier?.payoutAccounts || {},
                            profitRatio: Number(s.profitRatio ?? s.profit_ratio ?? details.profitRatio ?? fallbackSupplier?.profitRatio ?? 0),
                            transactions: Array.isArray(s.transactions) && s.transactions.length > 0 ? s.transactions : (fallbackSupplier?.transactions || [])
                        };
                    }).filter((s: any) => !isDummyMockSupplier(s)),
                    supplyOrders: (supplyOrders.length > 0 ? supplyOrders : (storeSettings.supplyOrders || local?.settings?.supplyOrders || [])).map((so: any) => {
                        const details = (so.details && typeof so.details === 'object') ? so.details : {};
                        return {
                            ...details,
                            ...so,
                            supplierId: so.supplierId || so.supplier_id || details.supplierId || '',
                            totalCost: Number(so.totalCost ?? so.total_cost ?? details.totalCost ?? 0)
                        };
                    }),
                    reviews: reviews.length > 0 ? reviews : (storeSettings.reviews || local?.settings?.reviews || []),
                    abandonedCarts: abandonedCarts.length > 0 ? abandonedCarts : (storeSettings.abandonedCarts || local?.settings?.abandonedCarts || []),
                    activityLogs: activityLogs.length > 0 ? activityLogs : (storeSettings.activityLogs || local?.settings?.activityLogs || []),
                    employees: employees.length > 0 ? employees : (storeSettings.employees || local?.settings?.employees || []),
                    discountCodes: discountCodes.length > 0 ? discountCodes : (storeSettings.discountCodes || local?.settings?.discountCodes || []),
                    collections: collectionsList.length > 0 ? collectionsList : (storeSettings.collections || local?.settings?.collections || []),
                    customPages: customPages.length > 0 ? customPages : (storeSettings.customPages || local?.settings?.customPages || []),
                    paymentMethods: paymentMethods.length > 0 ? paymentMethods : (storeSettings.paymentMethods || local?.settings?.paymentMethods || []),
                    globalOptions: globalOptions.length > 0 ? globalOptions : (storeSettings.globalOptions || local?.settings?.globalOptions || []),
                    shippingIntegrations: (shippingIntegrations.length > 0 ? shippingIntegrations : (storeSettings.shippingIntegrations || local?.settings?.shippingIntegrations || [])).map((si: any) => {
                        const details = si.details && typeof si.details === 'object' ? si.details : (typeof si.details === 'string' && si.details ? JSON.parse(si.details) : {});
                        return {
                            ...si,
                            provider: si.provider || '',
                            apiKey: si.apiKey || si.api_key || details?.apiKey || '',
                            apiSecret: si.apiSecret || si.api_secret || details?.apiSecret || '',
                            accountNumber: si.accountNumber || si.account_number || details?.accountNumber || '',
                            isConnected: Boolean(si.isConnected ?? si.is_connected ?? details?.isConnected ?? false)
                        };
                    }),
                    partners: (partners.length > 0 ? partners : (storeSettings.partners || local?.settings?.partners || [])).map((p: any) => {
                        const pNameNorm = String(p.name || '').trim().toLowerCase();
                        const fallbackPartner = (storeSettings.partners || []).find((fp: any) => fp.id === p.id || (pNameNorm && String(fp.name || '').trim().toLowerCase() === pNameNorm))
                            || (local?.settings?.partners || []).find((lp: any) => lp.id === p.id || (pNameNorm && String(lp.name || '').trim().toLowerCase() === pNameNorm));
                        const details = p.details && typeof p.details === 'object' ? p.details : (typeof p.details === 'string' && p.details ? JSON.parse(p.details) : {});
                        return {
                            ...fallbackPartner,
                            ...p,
                            email: p.email || details.email || fallbackPartner?.email || '',
                            passcode: p.passcode || details.passcode || fallbackPartner?.passcode || '0000',
                            password: p.password || details.password || fallbackPartner?.password || '',
                            requireEmailOtp: Boolean(p.requireEmailOtp ?? p.require_email_otp ?? details.requireEmailOtp ?? fallbackPartner?.requireEmailOtp ?? true),
                            isEmailVerified: Boolean(p.isEmailVerified ?? p.is_email_verified ?? details.isEmailVerified ?? fallbackPartner?.isEmailVerified ?? false),
                            emailVerifiedAt: p.emailVerifiedAt || p.email_verified_at || details.emailVerifiedAt || fallbackPartner?.emailVerifiedAt,
                            lastLoginAt: p.lastLoginAt || p.last_login_at || details.lastLoginAt || fallbackPartner?.lastLoginAt,
                            permissions: p.permissions || details.permissions || fallbackPartner?.permissions || {},
                            portalPermissions: p.portalPermissions || details.portalPermissions || fallbackPartner?.portalPermissions || {},
                            payoutAccounts: p.payoutAccounts || details.payoutAccounts || fallbackPartner?.payoutAccounts || {},
                            biometricCredentials: p.biometricCredentials || details.biometricCredentials || fallbackPartner?.biometricCredentials || [],
                            allowBiometricAuth: Boolean(p.allowBiometricAuth ?? details.allowBiometricAuth ?? fallbackPartner?.allowBiometricAuth ?? false)
                        };
                    }),
                    partnerTransactions: partnerTransactions.length > 0 ? partnerTransactions : (storeSettings.partnerTransactions || local?.settings?.partnerTransactions || []),
                    warehouses: warehouses.length > 0 ? warehouses : (storeSettings.warehouses || local?.settings?.warehouses || []),
                    inventoryAudits: inventoryAudits.length > 0 ? inventoryAudits : (storeSettings.inventoryAudits || []),
                    stockTransfers: stockTransfers.length > 0 ? stockTransfers : (storeSettings.stockTransfers || []),
                    orderReturns: orderReturns.length > 0 ? orderReturns : (storeSettings.orderReturns || []),
                    purchaseReturns: purchaseReturns.length > 0 ? purchaseReturns : (storeSettings.purchaseReturns || []),
                    posSales: posSales.length > 0 ? posSales : (storeSettings.posSales || []),
                    cashHolders: (cashHolders.length > 0 ? cashHolders : (storeSettings.cashHolders || local?.settings?.cashHolders || [])).map((ch: any) => ({
                        ...ch,
                        userId: ch.userId || ch.user_id || ch.id || '',
                        userName: ch.userName || ch.user_name || '',
                        currentBalance: Number(ch.currentBalance ?? ch.current_balance ?? 0),
                        lastUpdated: ch.lastUpdated || ch.last_updated || new Date().toISOString()
                    })),
                    cashHandovers: (cashHandovers.length > 0 ? cashHandovers : (storeSettings.cashHandovers || local?.settings?.cashHandovers || [])).map((ch: any) => ({
                        ...ch,
                        fromUserId: ch.fromUserId || ch.from_user_id || '',
                        fromUserName: ch.fromUserName || ch.from_user_name || '',
                        toUserId: ch.toUserId || ch.to_user_id || '',
                        toUserName: ch.toUserName || ch.to_user_name || '',
                        amount: Number(ch.amount ?? 0),
                        date: ch.date || '',
                        notes: ch.notes || '',
                        status: ch.status || ''
                    })),
                    whatsappTemplates: (whatsappTemplates || []).map((t: any) => {
                        const details = t.details && typeof t.details === 'object' ? t.details : (typeof t.details === 'string' && t.details ? JSON.parse(t.details) : {});
                        return {
                            ...t,
                            ...details
                        };
                    }),
                    callScripts
                },
                orders: (() => {
                    const mappedCloudOrders = (orders || []).map((o: any) => {
                        const detailsObj = o.details && typeof o.details === 'object' ? o.details : (typeof o.details === 'string' && o.details ? JSON.parse(o.details) : {});
                        const cleanTopLevel = Object.entries(o).reduce((acc: any, [key, val]) => {
                            if (val !== null && val !== undefined) acc[key] = val;
                            return acc;
                        }, {});
                        const baseOrder = { ...detailsObj };
                        Object.entries(cleanTopLevel).forEach(([key, val]) => {
                            const detailsVal = detailsObj[key];
                            const isZeroOverwritingPositive = val === 0 && typeof detailsVal === 'number' && detailsVal > 0 && ['insuranceFee', 'inspectionFee', 'codFee', 'productPrice', 'productCost', 'shippingFee', 'totalPrice'].includes(key);
                            const isValEmpty = val === null || val === undefined || isZeroOverwritingPositive || (Array.isArray(val) && val.length === 0) || (typeof val === 'object' && Object.keys(val).length === 0);
                            const isDetailsEmpty = detailsVal === null || detailsVal === undefined || (Array.isArray(detailsVal) && detailsVal.length === 0) || (typeof detailsVal === 'object' && Object.keys(detailsVal).length === 0);
                            if (isValEmpty && !isDetailsEmpty) {
                                // Keep non-empty value from detailsObj
                            } else {
                                baseOrder[key] = val;
                            }
                        });
                        const localOrder = local?.orders?.find((lo: any) => String(lo?.id || '').trim() === String(o?.id || '').trim() || (lo?.orderNumber && lo.orderNumber === o.orderNumber));
                        const rawCloudItems = Array.isArray(o.items) && o.items.length > 0 ? o.items : (Array.isArray(detailsObj.items) && detailsObj.items.length > 0 ? detailsObj.items : (Array.isArray(baseOrder.items) ? baseOrder.items : (baseOrder.items && typeof baseOrder.items === 'object' ? Object.values(baseOrder.items) : [])));
                        const localItems = localOrder && Array.isArray(localOrder.items) ? localOrder.items : [];
                        const itemsArray = (rawCloudItems.length > 0 || !localItems.length) ? rawCloudItems : localItems;

                        // Check if local order has a newer timestamp or recent manual status change
                        const localTime = new Date(localOrder?.updatedAt || localOrder?.statusUpdatedAt || 0).getTime();
                        const cloudTime = new Date(baseOrder.updatedAt || baseOrder.statusUpdatedAt || 0).getTime();
                        const isLocalStatusNewer = Boolean(
                            localOrder && 
                            localOrder.status && 
                            (
                                localTime > cloudTime || 
                                (Date.now() - localTime < 300000 && localOrder.status !== baseOrder.status)
                            )
                        );

                        const effectiveStatus = isLocalStatusNewer ? localOrder.status : baseOrder.status;
                        const effectiveUpdatedAt = isLocalStatusNewer ? (localOrder.updatedAt || new Date().toISOString()) : (baseOrder.updatedAt || baseOrder.date);

                        return {
                            ...baseOrder,
                            status: effectiveStatus,
                            updatedAt: effectiveUpdatedAt,
                            statusUpdatedAt: isLocalStatusNewer ? (localOrder.statusUpdatedAt || effectiveUpdatedAt) : (baseOrder.statusUpdatedAt || effectiveUpdatedAt),
                            items: itemsArray,
                            advancePayment: baseOrder.advancePayment ?? localOrder?.advancePayment ?? 0,
                            advancePaymentPartnerId: baseOrder.advancePaymentPartnerId ?? localOrder?.advancePaymentPartnerId,
                            advancePaymentTreasuryId: baseOrder.advancePaymentTreasuryId ?? localOrder?.advancePaymentTreasuryId,
                            advancePaymentEmployeeId: baseOrder.advancePaymentEmployeeId ?? (localOrder as any)?.advancePaymentEmployeeId,
                            advancePaymentRecipientPhone: baseOrder.advancePaymentRecipientPhone ?? localOrder?.advancePaymentRecipientPhone,
                            advancePaymentSenderDetails: baseOrder.advancePaymentSenderDetails ?? localOrder?.advancePaymentSenderDetails,
                            advancePaymentHistory: baseOrder.advancePaymentHistory ?? localOrder?.advancePaymentHistory ?? [],
                            flexShipFee: baseOrder.flexShipFee ?? localOrder?.flexShipFee,
                            flexShipCompanyFee: baseOrder.flexShipCompanyFee ?? localOrder?.flexShipCompanyFee,
                            flexShipFeePaidByCustomer: baseOrder.flexShipFeePaidByCustomer ?? localOrder?.flexShipFeePaidByCustomer,
                            enableFlexShip: baseOrder.enableFlexShip ?? localOrder?.enableFlexShip,
                            channel: baseOrder.channel ?? localOrder?.channel ?? 'online',
                            warehouseId: baseOrder.warehouseId ?? baseOrder.warehouse_id ?? localOrder?.warehouseId,
                            warehouse_id: baseOrder.warehouse_id ?? baseOrder.warehouseId ?? localOrder?.warehouseId,
                            createdBy: baseOrder.createdBy ?? localOrder?.createdBy,
                            source: baseOrder.source ?? localOrder?.source,
                            vatOnStandardShipping: baseOrder.vatOnStandardShipping ?? localOrder?.vatOnStandardShipping
                        };
                    });

                    const cloudOrderKeys = new Set(mappedCloudOrders.map((o: any) => String(o?.id || o?.orderNumber || '').trim()).filter(Boolean));
                    const localUnsyncedOrders = (local?.orders || []).filter((lo: any) => {
                        const key = String(lo?.id || lo?.orderNumber || '').trim();
                        return key && !cloudOrderKeys.has(key) && !isExplicitlyDeleted(lo?.id, storeId) && !isExplicitlyDeleted(lo?.orderNumber, storeId);
                    });
                    return [...mappedCloudOrders, ...localUnsyncedOrders].filter((o: any) => !isExplicitlyDeleted(o?.id, storeId) && !isExplicitlyDeleted(o?.orderNumber, storeId));
                })(),
                wallet: { balance: 0, transactions },
                treasury: { 
                    accounts: (treasuryAccounts || []).map((acc: any) => ({
                        ...acc,
                        id: acc.id,
                        name: acc.name,
                        type: acc.type,
                        balance: Number(acc.balance ?? 0),
                        currency: acc.currency || 'EGP',
                        accountNumber: acc.accountNumber || acc.account_number || '',
                        beneficiaryName: acc.beneficiaryName || acc.beneficiary_name || '',
                        bankName: acc.bankName || acc.bank_name || '',
                        walletNumber: acc.walletNumber || acc.wallet_number || '',
                        walletName: acc.walletName || acc.wallet_name || ''
                    })), 
                    transactions: (treasuryTransactions || []).map((tx: any) => ({
                        ...tx,
                        id: tx.id,
                        date: tx.date,
                        fromAccountId: tx.fromAccountId || tx.from_account_id || '',
                        toAccountId: tx.toAccountId || tx.to_account_id || '',
                        amount: Number(tx.amount ?? 0),
                        type: tx.type,
                        description: tx.description || '',
                        reference: tx.reference || ''
                    }))
                },
                cart: [],
                customers,
                quotations: (quotationsList && quotationsList.length > 0) ? quotationsList : (storeSettings?.quotations || local?.quotations || [])
            };

            // SAFEGUARD: If Supabase returns nothing but we have local data, 
            // it means we probably haven't synced UP yet. 
            // Only perform this fallback if we ARE NOT forcing a pull from remote.
            const hasCloudData = (products && products.length > 0) || (orders && orders.length > 0) || (customers && customers.length > 0) || (cashHolders && cashHolders.length > 0) || (cashHandovers && cashHandovers.length > 0);
            if (!hasCloudData && !forceRemote && local && (local.orders?.length > 0 || local.settings?.products?.length > 0 || local.settings?.cashHolders?.length > 0 || local.settings?.cashHandovers?.length > 0)) {
                console.log('[SUPABASE] Cloud empty but local has data. Using local to prevent wipe.');
                return local;
            }

            await saveLocal(storeId, fullData);
            return fullData;
        } catch (e: any) {
            if (isRestrictionError(e)) {
                console.warn('[SUPABASE-FETCH] Supabase project restricted (exceed_egress_quota). Falling through to native Firebase Firestore:', e?.message || e);
                setSupabaseRestricted(true);
                // Do not return local; smoothly proceed to Firebase Firestore step below
            } else {
                console.error('[SUPABASE-FETCH] Remote store read failed; returning the last local snapshot without overwriting it:', e);
                return local;
            }
        }
    }

    // 3. Fallback to Firestore cloud database (ensures external users & partner portal can load data)
    if (firebaseDb && !isFirestoreQuotaExhausted) {
        try {
            const storeRef = doc(firebaseDb, 'stores_data', storeId);
            const snap = await WITH_TIMEOUT(getDoc(storeRef), 8000);
            if (snap.exists()) {
                const cloudData = snap.data();
                const storeSettings = cloudData?.settings || {};

                const customization = {
                    ...(INITIAL_SETTINGS.customization || {}),
                    ...(storeSettings.customization || {})
                };
                if (!customization.pageSections || customization.pageSections.length === 0) {
                    customization.pageSections = INITIAL_SETTINGS.customization.pageSections;
                }

                const fullData: StoreData = {
                    settings: {
                        ...INITIAL_SETTINGS,
                        ...storeSettings,
                        customization,
                        storeName: storeSettings.storeName || cloudData?.name || local?.settings?.storeName || 'المتجر',
                        products: await (async () => {
                            const embeddedProducts = storeSettings.products || local?.settings?.products || [];
                            // Optimization: Skip collection fetch if not forced and we have embedded data
                            if (!forceRemote && embeddedProducts.length > 0) return embeddedProducts;
                            try {
                                const productsSnap = await getDocs(query(collection(firebaseDb, 'products'), where('storeId', '==', storeId)));
                                if (productsSnap.empty) return embeddedProducts;
                                
                                const colProducts = productsSnap.docs.map(d => ({ 
                                    id: d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id, 
                                    ...d.data() 
                                }));
                                
                                const merged = [...colProducts];
                                const colIds = new Set(colProducts.map((p: any) => p.id));
                                embeddedProducts.forEach((p: any) => { if (!colIds.has(p.id)) merged.push(p); });

                                return merged.map((cp: any) => {
                                    const details = (cp.details && typeof cp.details === 'object') ? cp.details : {};
                                    const localProd = local?.settings?.products?.find((lp: any) => lp.id === cp.id);
                                    const mergedThumbnail = cp.thumbnail || details.thumbnail || localProd?.thumbnail || (Array.isArray(cp.images) && cp.images[0]) || (Array.isArray(details.images) && details.images[0]) || (localProd?.images && localProd.images[0]) || '';
                                    const candidateImages = (Array.isArray(cp.images) && cp.images.length > 0) ? cp.images : (Array.isArray(details.images) && details.images.length > 0) ? details.images : (localProd?.images && localProd.images.length > 0) ? localProd.images : (mergedThumbnail ? [mergedThumbnail] : []);
                                    return { ...details, ...(localProd || {}), ...cp, thumbnail: mergedThumbnail, images: candidateImages };
                                });
                            } catch { return embeddedProducts; }
                        })(),
                        suppliers: await (async () => {
                            const embedded = sanitizeSuppliersList(storeSettings.suppliers || local?.settings?.suppliers || []);
                            // Optimization: Skip collection fetch if not forced and we have embedded data
                            if (!forceRemote && embedded.length > 0) return embedded;
                            try {
                                const snap = await getDocs(query(collection(firebaseDb, 'suppliers'), where('storeId', '==', storeId)));
                                if (snap.empty) return embedded;
                                const validDocs: any[] = [];
                                for (const d of snap.docs) {
                                    const rawId = d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id;
                                    const data = d.data();
                                    const item = { id: rawId, ...data };
                                    if (isDummyMockSupplier(item)) {
                                        deleteDoc(d.ref).catch(() => {});
                                        recordExplicitDeletion(`${storeId}_suppliers_${d.id}`);
                                        recordExplicitDeletion(`${storeId}_suppliers_${rawId}`);
                                        continue;
                                    }
                                    const isExplicitlyDeleted =
                                        EXPLICIT_DELETED_IDS.has(`${storeId}_suppliers_${d.id}`) ||
                                        EXPLICIT_DELETED_IDS.has(`${storeId}_suppliers_${rawId}`) ||
                                        EXPLICIT_DELETED_IDS.has(d.id) ||
                                        EXPLICIT_DELETED_IDS.has(rawId);
                                    if (!isExplicitlyDeleted) {
                                        validDocs.push(item);
                                    }
                                }
                                return sanitizeSuppliersList(validDocs);
                            } catch { return embedded; }
                        })(),
                        supplyOrders: await (async () => {
                            const embedded = storeSettings.supplyOrders || local?.settings?.supplyOrders || [];
                            if (!forceRemote && embedded.length > 0) return embedded;
                            if (isFirestoreQuotaExhausted) return embedded;
                            try {
                                const snap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'supply_orders'), where('storeId', '==', storeId))), 5000);
                                if (snap.empty) return embedded;
                                return snap.docs.map(d => ({ id: d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id, ...d.data() }));
                            } catch (err) { 
                                const msg = String((err as any)?.message || err);
                                if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                                return embedded; 
                            }
                        })(),
                        reviews: await (async () => {
                            const embedded = storeSettings.reviews || local?.settings?.reviews || [];
                            if (!forceRemote && embedded.length > 0) return embedded;
                            if (isFirestoreQuotaExhausted) return embedded;
                            try {
                                const snap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'reviews'), where('storeId', '==', storeId))), 5000);
                                if (snap.empty) return embedded;
                                return snap.docs.map(d => ({ id: d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id, ...d.data() }));
                            } catch (err) { 
                                const msg = String((err as any)?.message || err);
                                if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                                return embedded; 
                            }
                        })(),
                        abandonedCarts: await (async () => {
                            const embedded = storeSettings.abandonedCarts || local?.settings?.abandonedCarts || [];
                            if (!forceRemote && embedded.length > 0) return embedded;
                            if (isFirestoreQuotaExhausted) return embedded;
                            try {
                                const snap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'abandoned_carts'), where('storeId', '==', storeId))), 5000);
                                if (snap.empty) return embedded;
                                return snap.docs.map(d => ({ id: d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id, ...d.data() }));
                            } catch (err) { 
                                const msg = String((err as any)?.message || err);
                                if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                                return embedded; 
                            }
                        })(),
                        activityLogs: await (async () => {
                            const embedded = storeSettings.activityLogs || local?.settings?.activityLogs || [];
                            if (!forceRemote && embedded.length > 0) return embedded;
                            if (isFirestoreQuotaExhausted) return embedded;
                            try {
                                const snap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'activity_logs'), where('storeId', '==', storeId))), 5000);
                                if (snap.empty) return embedded;
                                return snap.docs.map(d => ({ id: d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id, ...d.data() }));
                            } catch (err) { 
                                const msg = String((err as any)?.message || err);
                                if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                                return embedded; 
                            }
                        })(),
                        employees: await (async () => {
                            const embedded = storeSettings.employees || local?.settings?.employees || [];
                            if (!forceRemote && embedded.length > 0) return embedded;
                            if (isFirestoreQuotaExhausted) return embedded;
                            try {
                                const snap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'employees'), where('storeId', '==', storeId))), 5000);
                                if (snap.empty) return embedded;
                                return snap.docs.map(d => ({ id: d.id.split('_').pop(), ...d.data() }));
                            } catch (err) { 
                                const msg = String((err as any)?.message || err);
                                if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                                return embedded; 
                            }
                        })(),
                        merchantRequests: await (async () => {
                            const embedded = local?.merchantRequests || [];
                            if (isFirestoreQuotaExhausted) return embedded;
                            try {
                                const snap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'merchant_requests'), where('storeId', '==', storeId))), 5000);
                                if (snap.empty) return embedded;
                                return snap.docs.map(d => ({ id: d.id, ...d.data() }));
                            } catch (err) {
                                const msg = String((err as any)?.message || err);
                                if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                                return embedded;
                            }
                        })(),
                        partnerRequests: await (async () => {
                            const embedded = local?.partnerRequests || [];
                            if (isFirestoreQuotaExhausted) return embedded;
                            try {
                                const snap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'partner_requests'), where('storeId', '==', storeId))), 5000);
                                if (snap.empty) return embedded;
                                return snap.docs.map(d => ({ id: d.id, ...d.data() }));
                            } catch (err) {
                                const msg = String((err as any)?.message || err);
                                if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                                return embedded;
                            }
                        })(),
                        discountCodes: await (async () => {
                            const embedded = storeSettings.discountCodes || local?.settings?.discountCodes || [];
                            if (!forceRemote && embedded.length > 0) return embedded;
                            try {
                                const snap = await getDocs(query(collection(firebaseDb, 'discount_codes'), where('storeId', '==', storeId)));
                                if (snap.empty) return embedded;
                                return snap.docs.map(d => ({ id: d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id, ...d.data() }));
                            } catch (err) { 
                                const msg = String((err as any)?.message || err);
                                if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                                return embedded; 
                            }
                        })(),
                        collections: await (async () => {
                            const embedded = storeSettings.collections || local?.settings?.collections || [];
                            if (!forceRemote && embedded.length > 0) return embedded;
                            if (isFirestoreQuotaExhausted) return embedded;
                            try {
                                const snap = await getDocs(query(collection(firebaseDb, 'collections'), where('storeId', '==', storeId)));
                                if (snap.empty) return embedded;
                                return snap.docs.map(d => ({ id: d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id, ...d.data() }));
                            } catch (err) { 
                                const msg = String((err as any)?.message || err);
                                if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                                return embedded; 
                            }
                        })(),
                        customPages: await (async () => {
                            const embedded = storeSettings.customPages || local?.settings?.customPages || [];
                            if (!forceRemote && embedded.length > 0) return embedded;
                            if (isFirestoreQuotaExhausted) return embedded;
                            try {
                                const snap = await getDocs(query(collection(firebaseDb, 'custom_pages'), where('storeId', '==', storeId)));
                                if (snap.empty) return embedded;
                                return snap.docs.map(d => ({ id: d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id, ...d.data() }));
                            } catch (err) { 
                                const msg = String((err as any)?.message || err);
                                if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                                return embedded; 
                            }
                        })(),
                        paymentMethods: await (async () => {
                            const embedded = storeSettings.paymentMethods || local?.settings?.paymentMethods || [];
                            if (!forceRemote && embedded.length > 0) return embedded;
                            if (isFirestoreQuotaExhausted) return embedded;
                            try {
                                const snap = await getDocs(query(collection(firebaseDb, 'payment_methods'), where('storeId', '==', storeId)));
                                if (snap.empty) return embedded;
                                return snap.docs.map(d => ({ id: d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id, ...d.data() }));
                            } catch (err) { 
                                const msg = String((err as any)?.message || err);
                                if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                                return embedded; 
                            }
                        })(),
                        globalOptions: await (async () => {
                            const embedded = storeSettings.globalOptions || local?.settings?.globalOptions || [];
                            if (!forceRemote && embedded.length > 0) return embedded;
                            if (isFirestoreQuotaExhausted) return embedded;
                            try {
                                const snap = await getDocs(query(collection(firebaseDb, 'global_options'), where('storeId', '==', storeId)));
                                if (snap.empty) return embedded;
                                return snap.docs.map(d => ({ id: d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id, ...d.data() }));
                            } catch (err) { 
                                const msg = String((err as any)?.message || err);
                                if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                                return embedded; 
                            }
                        })(),
                        shippingIntegrations: await (async () => {
                            const embedded = storeSettings.shippingIntegrations || local?.settings?.shippingIntegrations || [];
                            if (!forceRemote && embedded.length > 0) return embedded;
                            if (isFirestoreQuotaExhausted) return embedded;
                            try {
                                const snap = await getDocs(query(collection(firebaseDb, 'shipping_integrations'), where('storeId', '==', storeId)));
                                if (snap.empty) return embedded;
                                return snap.docs.map(d => ({ id: d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id, ...d.data() }));
                            } catch (err) { 
                                const msg = String((err as any)?.message || err);
                                if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                                return embedded; 
                            }
                        })(),
                        partners: await (async () => {
                            const embedded = storeSettings.partners || local?.settings?.partners || [];
                            if (!forceRemote && embedded.length > 0) return embedded;
                            if (isFirestoreQuotaExhausted) return embedded;
                            try {
                                const snap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'partners'), where('storeId', '==', storeId))), 5000);
                                if (snap.empty) return embedded;
                                return snap.docs.map(d => ({ id: d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id, ...d.data() }));
                            } catch (err) { 
                                const msg = String((err as any)?.message || err);
                                if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                                return embedded; 
                            }
                        })(),
                        partnerTransactions: await (async () => {
                            const embedded = storeSettings.partnerTransactions || local?.settings?.partnerTransactions || [];
                            if (!forceRemote && embedded.length > 0) return embedded;
                            if (isFirestoreQuotaExhausted) return embedded;
                            try {
                                const snap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'partner_transactions'), where('storeId', '==', storeId))), 5000);
                                if (snap.empty) return embedded;
                                return snap.docs.map(d => ({ id: d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id, ...d.data() }));
                            } catch (err) { 
                                const msg = String((err as any)?.message || err);
                                if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                                return embedded; 
                            }
                        })(),
                        warehouses: await (async () => {
                            const embedded = storeSettings.warehouses || local?.settings?.warehouses || [];
                            if (!forceRemote && embedded.length > 0) return embedded;
                            if (isFirestoreQuotaExhausted) return embedded;
                            try {
                                const snap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'warehouses'), where('storeId', '==', storeId))), 5000);
                                if (snap.empty) return embedded;
                                return snap.docs.map(d => ({ id: d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id, ...d.data() }));
                            } catch (err) { 
                                const msg = String((err as any)?.message || err);
                                if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                                return embedded; 
                            }
                        })(),
                        inventoryAudits: await (async () => {
                            const embedded = storeSettings.inventoryAudits || local?.settings?.inventoryAudits || [];
                            if (!forceRemote && embedded.length > 0) return embedded;
                            if (isFirestoreQuotaExhausted) return embedded;
                            try {
                                const snap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'inventory_audits'), where('storeId', '==', storeId))), 5000);
                                if (snap.empty) return embedded;
                                return snap.docs.map(d => ({ id: d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id, ...d.data() }));
                            } catch (err) { 
                                const msg = String((err as any)?.message || err);
                                if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                                return embedded; 
                            }
                        })(),
                        stockTransfers: await (async () => {
                            const embedded = storeSettings.stockTransfers || local?.settings?.stockTransfers || [];
                            if (!forceRemote && embedded.length > 0) return embedded;
                            if (isFirestoreQuotaExhausted) return embedded;
                            try {
                                const snap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'stock_transfers'), where('storeId', '==', storeId))), 5000);
                                if (snap.empty) return embedded;
                                return snap.docs.map(d => ({ id: d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id, ...d.data() }));
                            } catch (err) { 
                                const msg = String((err as any)?.message || err);
                                if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                                return embedded; 
                            }
                        })(),
                        orderReturns: await (async () => {
                            const embedded = storeSettings.orderReturns || local?.settings?.orderReturns || [];
                            if (!forceRemote && embedded.length > 0) return embedded;
                            if (isFirestoreQuotaExhausted) return embedded;
                            try {
                                const snap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'order_returns'), where('storeId', '==', storeId))), 5000);
                                if (snap.empty) return embedded;
                                return snap.docs.map(d => ({ id: d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id, ...d.data() }));
                            } catch (err) { 
                                const msg = String((err as any)?.message || err);
                                if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                                return embedded; 
                            }
                        })(),
                        purchaseReturns: await (async () => {
                            const embedded = storeSettings.purchaseReturns || local?.settings?.purchaseReturns || [];
                            if (!forceRemote && embedded.length > 0) return embedded;
                            if (isFirestoreQuotaExhausted) return embedded;
                            try {
                                const snap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'purchase_returns'), where('storeId', '==', storeId))), 5000);
                                if (snap.empty) return embedded;
                                return snap.docs.map(d => ({ id: d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id, ...d.data() }));
                            } catch (err) { 
                                const msg = String((err as any)?.message || err);
                                if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                                return embedded; 
                            }
                        })(),
                        posSales: await (async () => {
                            const embedded = storeSettings.posSales || local?.settings?.posSales || [];
                            if (!forceRemote && embedded.length > 0) return embedded;
                            if (isFirestoreQuotaExhausted) return embedded;
                            try {
                                const snap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'pos_sales'), where('storeId', '==', storeId))), 5000);
                                if (snap.empty) return embedded;
                                return snap.docs.map(d => ({ id: d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id, ...d.data() }));
                            } catch (err) { 
                                const msg = String((err as any)?.message || err);
                                if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                                return embedded; 
                            }
                        })(),
                        cashHolders: await (async () => {
                            const embedded = storeSettings.cashHolders || local?.settings?.cashHolders || [];
                            if (!forceRemote && embedded.length > 0) return embedded;
                            if (isFirestoreQuotaExhausted) return embedded;
                            try {
                                const snap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'cash_holders'), where('storeId', '==', storeId))), 5000);
                                if (snap.empty) return embedded;
                                return snap.docs.map(d => ({ ...d.data(), userId: d.id.split('_').pop() }));
                            } catch (err) { 
                                const msg = String((err as any)?.message || err);
                                if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                                return embedded; 
                            }
                        })(),
                        cashHandovers: await (async () => {
                            const embedded = storeSettings.cashHandovers || local?.settings?.cashHandovers || [];
                            if (!forceRemote && embedded.length > 0) return embedded;
                            if (isFirestoreQuotaExhausted) return embedded;
                            try {
                                const snap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'cash_handovers'), where('storeId', '==', storeId))), 5000);
                                if (snap.empty) return embedded;
                                return snap.docs.map(d => ({ id: d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id, ...d.data() }));
                            } catch (err) { 
                                const msg = String((err as any)?.message || err);
                                if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                                return embedded; 
                            }
                        })(),
                        whatsappTemplates: await (async () => {
                            const embedded = storeSettings.whatsappTemplates || local?.settings?.whatsappTemplates || [];
                            if (!forceRemote && embedded.length > 0) return embedded;
                            if (isFirestoreQuotaExhausted) return embedded;
                            try {
                                const snap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'whatsapp_templates'), where('storeId', '==', storeId))), 5000);
                                if (snap.empty) return embedded;
                                return snap.docs.map(d => {
                                    const data = d.data();
                                    const details = (data.details && typeof data.details === 'object') ? data.details : {};
                                    return { id: d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id, ...data, ...details };
                                });
                            } catch (err) { 
                                const msg = String((err as any)?.message || err);
                                if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                                return embedded; 
                            }
                        })(),
                        callScripts: storeSettings.callScripts || local?.settings?.callScripts || []
                    },
                    orders: await (async () => {
                        const cloudOrdersList = Array.isArray(cloudData?.orders) ? cloudData.orders : [];
                        const localOrdersList = Array.isArray(local?.orders) ? local.orders : [];
                        
                        const orderMap = new Map<string, any>();
                        localOrdersList.forEach((o: any) => {
                            const k = String(o?.id || o?.orderNumber || '').trim();
                            if (k) orderMap.set(k, o);
                        });
                        cloudOrdersList.forEach((o: any) => {
                            const k = String(o?.id || o?.orderNumber || '').trim();
                            if (k) {
                                const exist = orderMap.get(k);
                                orderMap.set(k, exist ? { ...exist, ...o } : o);
                            }
                        });

                        const embeddedOrders = Array.from(orderMap.values()).filter((o: any) => !isExplicitlyDeleted(o?.id, storeId) && !isExplicitlyDeleted(o?.orderNumber, storeId));
                        if (isFirestoreQuotaExhausted) return embeddedOrders;
                        try {
                            let ordersSnap = null;
                            if (forceRemote || embeddedOrders.length === 0) {
                                ordersSnap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'orders'), where('storeId', '==', storeId))), 10000);
                                if (!ordersSnap || ordersSnap.empty) {
                                    ordersSnap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'orders'), where('store_id', '==', storeId))), 10000);
                                }
                            }
                            if (!ordersSnap || ordersSnap.empty) return embeddedOrders;
                            const colOrders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                            const reconciled = reconcileDualOrderSources(storeId, embeddedOrders, colOrders, EXPLICIT_DELETED_IDS, true);
                            return reconciled.mergedOrders.filter((o: any) => !isExplicitlyDeleted(o?.id, storeId) && !isExplicitlyDeleted(o?.orderNumber, storeId));
                        } catch (err) {
                            const msg = String((err as any)?.message || err);
                            if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                            return embeddedOrders;
                        }
                    })(),
                    wallet: await (async () => {
                        const baseWallet = cloudData?.wallet || local?.wallet || { balance: storeSettings.wallet_balance || 0, transactions: [] };
                        if (isFirestoreQuotaExhausted) return baseWallet;
                        try {
                            const snap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'transactions'), where('storeId', '==', storeId))), 5000);
                            if (snap.empty) return baseWallet;
                            const txs = snap.docs.map(d => ({ id: d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id, ...d.data() }));
                            return { ...baseWallet, transactions: txs };
                        } catch (err) { 
                            const msg = String((err as any)?.message || err);
                            if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                            return baseWallet; 
                        }
                    })(),
                    treasury: await (async () => {
                        const baseTreasury = cloudData?.treasury || local?.treasury || { accounts: [], transactions: [] };
                        if (isFirestoreQuotaExhausted) return baseTreasury;
                        try {
                            const [accSnap, txSnap] = await Promise.all([
                                WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'treasury_accounts'), where('storeId', '==', storeId))), 5000),
                                WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'treasury_transactions'), where('storeId', '==', storeId))), 5000)
                            ]);
                            return {
                                accounts: accSnap.empty ? baseTreasury.accounts : accSnap.docs.map(d => ({ id: d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id, ...d.data() })),
                                transactions: txSnap.empty ? baseTreasury.transactions : txSnap.docs.map(d => ({ id: d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id, ...d.data() }))
                            };
                        } catch (err) { 
                            const msg = String((err as any)?.message || err);
                            if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                            return baseTreasury; 
                        }
                    })(),
                    merchantRequests: await (async () => {
                        const embedded = local?.merchantRequests || [];
                        if (isFirestoreQuotaExhausted) return embedded;
                        try {
                            const snap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'merchant_requests'), where('storeId', '==', storeId))), 5000);
                            if (snap.empty) return embedded;
                            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
                        } catch (err) {
                            const msg = String((err as any)?.message || err);
                            if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                            return embedded;
                        }
                    })(),
                    partnerRequests: await (async () => {
                        const embedded = local?.partnerRequests || [];
                        if (isFirestoreQuotaExhausted) return embedded;
                        try {
                            const snap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'partner_requests'), where('storeId', '==', storeId))), 5000);
                            if (snap.empty) return embedded;
                            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
                        } catch (err) {
                            const msg = String((err as any)?.message || err);
                            if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
                            return embedded;
                        }
                    })(),
                    cart: [],
                    customers: cloudData?.customers || local?.customers || [],
                    quotations: cloudData?.quotations || local?.quotations || []
                };

                await saveLocal(storeId, fullData);
                return fullData;
            }
        } catch (firestoreErr) {
            console.warn('[FIRESTORE-FETCH] Could not fetch store from Firestore:', firestoreErr);
        }
    }

    return local;
};

export const saveStoreData = async (store: Store, data: StoreData): Promise<{ success: boolean, error?: string }> => {
    await saveLocal(store.id, data);

    // Destructure items to sync relationally
    const { 
        products = [], suppliers: rawSuppliers = [], supplyOrders = [], reviews = [], abandonedCarts = [], activityLogs = [],
        employees = [], discountCodes = [], collections = [], customPages = [], paymentMethods = [],
        globalOptions = [], shippingIntegrations = [], partners = [], partnerTransactions = [],
        warehouses = [], inventoryAudits = [], stockTransfers = [], orderReturns = [], purchaseReturns = [],
        posSales = [], cashHolders = [], cashHandovers = [], whatsappTemplates = [], callScripts = [],
        ...cleanSettings 
    } = data.settings;
    const suppliers = sanitizeSuppliersList(rawSuppliers);
    
    const { orders = [], wallet = { balance: 0, transactions: [] }, treasury = { accounts: [], transactions: [] }, customers = [] } = data;

    // SAFEGUARD: Keep products/collections in main document if they are few (Hybrid redundancy)
    // This ensures storefront always works even if sub-collection fetch fails
    // CRITICAL: Strip huge base64 thumbnails from redundantSettings so stores_data document NEVER exceeds 1MB limit
    const redundantSettings: any = {};
    if (products.length < 150) {
        redundantSettings.products = products.map((p: any) => {
            const finalThumb = p.thumbnail || (Array.isArray(p.images) && p.images[0]) || '';
            const finalImages = (Array.isArray(p.images) && p.images.length > 0) ? p.images : (finalThumb ? [finalThumb] : []);
            if (finalThumb && typeof finalThumb === 'string' && finalThumb.startsWith('data:') && finalThumb.length > 40000) {
                return { ...p, thumbnail: '', images: [] };
            }
            return {
                ...p,
                thumbnail: finalThumb,
                images: finalImages
            };
        });
    }
    if (collections.length < 50) redundantSettings.collections = collections;
    if (customPages.length < 50) redundantSettings.customPages = customPages;
    redundantSettings.partners = partners;
    redundantSettings.suppliers = suppliers;
    redundantSettings.partnerTransactions = partnerTransactions;
    redundantSettings.cashHolders = cashHolders;
    redundantSettings.cashHandovers = cashHandovers;

    const cleanSettingsFinal = cleanUndefined({
        ...cleanSettings,
        ...redundantSettings,
        wallet_settings: wallet.settings || null,
        withdraw_requests: wallet.withdrawRequests || [],
        supply_balance: wallet.supplyBalance || 0,
        wallet_balance: wallet.balance || 0
    });

    // --- Custom Hostinger MySQL Save Logic ---
    const hostingerActive = isHostingerActive();
    if (hostingerActive) {
      try {
        const syncToHostinger = async (table: string, items: any[]) => {
          const fingerprintKey = `${store.id}:hostinger:${table}`;
          const fingerprint = JSON.stringify(items);
          if (syncFingerprints.get(fingerprintKey) === fingerprint) return;

          const res = await fetch('/api/mysql/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table, items, storeId: store.id })
          });
          if (res.ok) syncFingerprints.set(fingerprintKey, fingerprint);
        };

        await Promise.all([
          syncToHostinger('stores_data', [{ id: store.id, name: store.name, settings: cleanSettingsFinal }]),
          syncToHostinger('products', products),
          syncToHostinger('orders', orders),
          syncToHostinger('partner_transactions', partnerTransactions),
          syncToHostinger('suppliers', suppliers),
          syncToHostinger('partners', partners),
        ]);
      } catch (e) {
        console.warn('[HOSTINGER-SYNC] Failed:', e);
      }
    }

    // --- Custom Supabase Save Logic (Ultra-Optimized for Low Egress) ---
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseActive()) {
        let supabaseSaveSucceeded = false;
        try {
            // 1. Send clean, lightweight settings to stores_data without repeating massive relational tables
            const cleanSettingsSupabase = cleanUndefined({
                ...cleanSettings,
                partners: partners || [],
                suppliers: suppliers || [],
                wallet_settings: wallet.settings || null,
                withdraw_requests: wallet.withdrawRequests || [],
                supply_balance: wallet.supplyBalance || 0,
                wallet_balance: wallet.balance || 0,
                quotations: data.quotations || []
            });

            const storesDataFingerprintKey = `${store.id}:stores_data_header`;
            const storesDataFingerprint = JSON.stringify({ name: store.name, settings: cleanSettingsSupabase });

            if (syncFingerprints.get(storesDataFingerprintKey) !== storesDataFingerprint) {
                try {
                    const { error: storesDataError } = await supabase.from('stores_data').upsert({
                        id: store.id,
                        name: store.name,
                        settings: cleanSettingsSupabase
                    });
                    if (storesDataError) throw storesDataError;
                    syncFingerprints.set(storesDataFingerprintKey, storesDataFingerprint);
                } catch (storesDataErr: any) {
                    console.warn('[SUPABASE-SYNC] Error updating stores_data:', storesDataErr?.message || storesDataErr);
                    if (isRestrictionError(storesDataErr)) {
                        setSupabaseRestricted(true);
                    }
                    throw storesDataErr;
                }
            }

            // 2. Synchronize Users only when user list actually changes (Fingerprinted)
            const localGlobal = await getLocal('global');
            const usersList = localGlobal?.users || [];
            const usersFingerprintKey = 'global:users_sync';
            const usersFingerprint = JSON.stringify(usersList.map((u: any) => ({ phone: u?.phone, name: u?.fullName, email: u?.email })));
            if (syncFingerprints.get(usersFingerprintKey) !== usersFingerprint) {
                // Map users to relational format
                const emailSeenInPayload = new Set<string>();
                const mappedUsersList = usersList.map((user: any) => {
                    let userEmail = user.email ? user.email.trim() : null;
                    if (userEmail) {
                        const lowerEmail = userEmail.toLowerCase();
                        if (emailSeenInPayload.has(lowerEmail)) {
                            userEmail = null;
                        } else {
                            emailSeenInPayload.add(lowerEmail);
                        }
                    }
                    return {
                        phone: user.phone || '',
                        full_name: user.fullName || '',
                        email: userEmail,
                        is_admin: user.isAdmin || false,
                        is_banned: user.isBanned || false,
                        join_date: user.joinDate || null,
                        stores: user.stores || [],
                        sites: user.sites || []
                    };
                }).filter((u: any) => !!u.phone);

                if (mappedUsersList.length > 0) {
                    try {
                        const { error: usersError } = await supabase.from('users').upsert(mappedUsersList, { onConflict: 'phone' });
                        if (!usersError) {
                            syncFingerprints.set(usersFingerprintKey, usersFingerprint);
                        }
                    } catch (uErr: any) {
                        console.warn('Upserting users threw error:', uErr?.message || uErr);
                    }
                }
            }

            const syncTable = async (table: string, rawItems: any[], omitFields: string[] = []) => {
                if (knownMissingTables.has(table)) {
                    return;
                }
                const items = Array.isArray(rawItems) ? rawItems : [];
                const fingerprintKey = `${store.id}:${table}`;
                const fingerprint = JSON.stringify(items);
                if (syncFingerprints.get(fingerprintKey) === fingerprint) return;
                // 1. Handle Deletions (Explicit Authorized Deletion Only - Inferred Deletion Disabled)
                try {
                    const idField = table === 'employees' ? 'phone' : (table === 'cash_holders' ? 'user_id' : 'id');
                    const { data: cloudItems, error: fetchError } = await supabase
                        .from(table)
                        .select(idField)
                        .eq('store_id', store.id);

                    if (!fetchError && cloudItems) {
                        const idsToDelete = cloudItems
                            .map((ci: any) => String(ci[idField]))
                            .filter(id => {
                                if (!id) return false;
                                const isExplicitlyDeleted =
                                    EXPLICIT_DELETED_IDS.has(`${store.id}_${table}_${id}`) ||
                                    EXPLICIT_DELETED_IDS.has(`${store.id}_${table}_${store.id}_${id}`);
                                return shouldDeleteCloudRecord({
                                    collectionName: table,
                                    isExplicitlyDeleted
                                }).allowDelete;
                            });

                        if (idsToDelete.length > 0) {
                            await supabase.from(table).delete().eq('store_id', store.id).in(idField, idsToDelete);
                        }
                    }
                } catch (deletionErr: any) {
                    console.warn(`[SYNC] Failed to handle deletions for ${table}:`, deletionErr?.message || deletionErr);
                }

                if (!items || items.length === 0) return;
                const itemsFiltered = items.map(item => {
                    const cleanItem = { ...item };
                    omitFields.forEach(field => delete cleanItem[field]);
                    
                    // Robustness check for employees: ensure phone is set from id if missing
                    if (table === 'employees' && !cleanItem.phone && cleanItem.id) {
                        cleanItem.phone = cleanItem.id;
                    }
                    
                    let mappedItem = { ...cleanItem, store_id: store.id };

                    if (table === 'supply_orders') {
                        const rawSupId = String(cleanItem.supplierId || cleanItem.supplier_id || '').trim();
                        const validSupplierIds = new Set((suppliers || []).map((s: any) => String(s?.id || '').trim()).filter(Boolean));
                        const fkSafeSupplierId = rawSupId && validSupplierIds.has(rawSupId) ? rawSupId : null;
                        const existingDetails = (cleanItem.details && typeof cleanItem.details === 'object') ? cleanItem.details : {};
                        mappedItem = {
                            ...mappedItem,
                            supplier_id: fkSafeSupplierId,
                            supplierId: rawSupId || null,
                            total_cost: Number(cleanItem.totalCost ?? cleanItem.total_cost ?? 0),
                            details: rawSupId ? { ...existingDetails, supplierId: rawSupId } : existingDetails
                        };
                    } else if (table === 'cash_holders') {
                        mappedItem = {
                            ...mappedItem,
                            user_id: cleanItem.userId || cleanItem.user_id || cleanItem.id || '',
                            userid: cleanItem.userId || cleanItem.user_id || cleanItem.id || '',
                            user_name: cleanItem.userName || cleanItem.user_name || '',
                            username: cleanItem.userName || cleanItem.user_name || '',
                            current_balance: Number(cleanItem.currentBalance ?? cleanItem.current_balance ?? 0),
                            currentbalance: Number(cleanItem.currentBalance ?? cleanItem.current_balance ?? 0),
                            last_updated: cleanItem.lastUpdated || cleanItem.last_updated || '',
                            lastupdated: cleanItem.lastUpdated || cleanItem.last_updated || ''
                        };
                        delete (mappedItem as any).userId;
                        delete (mappedItem as any).userName;
                        delete (mappedItem as any).currentBalance;
                        delete (mappedItem as any).lastUpdated;
                    } else if (table === 'cash_handovers') {
                        mappedItem = {
                            ...mappedItem,
                            store_id: store.id,
                            storeId: cleanItem.storeId || store.id,
                            from_user_id: cleanItem.fromUserId || cleanItem.from_user_id || '',
                            fromuserid: cleanItem.fromUserId || cleanItem.from_user_id || '',
                            from_user_name: cleanItem.fromUserName || cleanItem.from_user_name || '',
                            fromusername: cleanItem.fromUserName || cleanItem.from_user_name || '',
                            to_user_id: cleanItem.toUserId || cleanItem.to_user_id || '',
                            touserid: cleanItem.toUserId || cleanItem.to_user_id || '',
                            to_user_name: cleanItem.toUserName || cleanItem.to_user_name || '',
                            tousername: cleanItem.toUserName || cleanItem.to_user_name || '',
                            amount: Number(cleanItem.amount ?? 0),
                            date: cleanItem.date || '',
                            notes: cleanItem.notes || '',
                            status: cleanItem.status || 'completed',
                            is_virtual: cleanItem.isVirtual !== undefined ? Boolean(cleanItem.isVirtual) : false,
                            isvirtual: cleanItem.isVirtual !== undefined ? Boolean(cleanItem.isVirtual) : false,
                            order_number: cleanItem.orderNumber || cleanItem.order_number || '',
                            ordernumber: cleanItem.orderNumber || cleanItem.order_number || '',
                            order_id: cleanItem.orderId || cleanItem.order_id || '',
                            orderid: cleanItem.orderId || cleanItem.order_id || '',
                            type: cleanItem.type || '',
                            details: cleanItem.details || {}
                        };
                    } else if (table === 'partners') {
                        mappedItem = {
                            id: cleanItem.id,
                            store_id: store.id,
                            storeId: cleanItem.storeId || store.id,
                            name: cleanItem.name || '',
                            phone: cleanItem.phone || '',
                            notes: cleanItem.notes || '',
                            balance: Number(cleanItem.balance ?? 0),
                            profit_ratio: Number(cleanItem.profitRatio ?? cleanItem.profit_ratio ?? 0),
                            profitratio: Number(cleanItem.profitRatio ?? cleanItem.profit_ratio ?? 0),
                            profitRatio: Number(cleanItem.profitRatio ?? cleanItem.profit_ratio ?? 0),
                            capital: Number(cleanItem.capital ?? 0),
                            initialCapital: Number(cleanItem.initialCapital ?? cleanItem.initial_capital ?? 0),
                            initial_capital: Number(cleanItem.initialCapital ?? cleanItem.initial_capital ?? 0)
                        };
                    } else if (table === 'partner_transactions') {
                        mappedItem = {
                            ...mappedItem,
                            partner_id: cleanItem.partnerId || cleanItem.partner_id || '',
                            partnerid: cleanItem.partnerId || cleanItem.partner_id || '',
                            partnerId: cleanItem.partnerId || cleanItem.partner_id || '',
                            partner_name: cleanItem.partnerName || cleanItem.partner_name || '',
                            partnerName: cleanItem.partnerName || cleanItem.partner_name || '',
                            treasury_account_id: cleanItem.treasuryAccountId || cleanItem.treasury_account_id || '',
                            treasuryAccountId: cleanItem.treasuryAccountId || cleanItem.treasury_account_id || '',
                            orderId: cleanItem.orderId || cleanItem.order_id || '',
                            order_id: cleanItem.orderId || cleanItem.order_id || '',
                            orderNumber: cleanItem.orderNumber || cleanItem.order_number || '',
                            order_number: cleanItem.orderNumber || cleanItem.order_number || '',
                            type: cleanItem.type || '',
                            amount: Number(cleanItem.amount ?? 0),
                            date: cleanItem.date || '',
                            note: cleanItem.note || cleanItem.notes || '',
                            notes: cleanItem.notes || cleanItem.note || '',
                            description: cleanItem.description || '',
                            category: cleanItem.category || ''
                        };
                    } else if (table === 'treasury_accounts') {
                        mappedItem = {
                            ...mappedItem,
                            name: cleanItem.name || '',
                            type: cleanItem.type || 'safe',
                            balance: Number(cleanItem.balance ?? 0),
                            currency: cleanItem.currency || 'EGP',
                            account_number: cleanItem.accountNumber || cleanItem.account_number || '',
                            accountNumber: cleanItem.accountNumber || cleanItem.account_number || '',
                            beneficiary_name: cleanItem.beneficiaryName || cleanItem.beneficiary_name || '',
                            beneficiaryName: cleanItem.beneficiaryName || cleanItem.beneficiary_name || '',
                            bank_name: cleanItem.bankName || cleanItem.bank_name || '',
                            bankName: cleanItem.bankName || cleanItem.bank_name || '',
                            wallet_number: cleanItem.walletNumber || cleanItem.wallet_number || '',
                            walletNumber: cleanItem.walletNumber || cleanItem.wallet_number || '',
                            wallet_name: cleanItem.walletName || cleanItem.wallet_name || '',
                            walletName: cleanItem.walletName || cleanItem.wallet_name || ''
                        };
                    } else if (table === 'treasury_transactions') {
                        mappedItem = {
                            ...mappedItem,
                            date: cleanItem.date || '',
                            from_account_id: cleanItem.fromAccountId || cleanItem.from_account_id || '',
                            fromAccountId: cleanItem.fromAccountId || cleanItem.from_account_id || '',
                            to_account_id: cleanItem.toAccountId || cleanItem.to_account_id || '',
                            toAccountId: cleanItem.toAccountId || cleanItem.to_account_id || '',
                            amount: Number(cleanItem.amount ?? 0),
                            type: cleanItem.type || 'deposit',
                            description: cleanItem.description || '',
                            reference: cleanItem.reference || '',
                            orderId: cleanItem.orderId || cleanItem.order_id || '',
                            order_id: cleanItem.orderId || cleanItem.order_id || '',
                            orderNumber: cleanItem.orderNumber || cleanItem.order_number || '',
                            order_number: cleanItem.orderNumber || cleanItem.order_number || ''
                        };
                    } else if (table === 'whatsapp_templates') {
                        const detailsObj: any = {
                            ...(cleanItem.details || {})
                        };
                        Object.keys(cleanItem).forEach(key => {
                            if (!['id', 'store_id', 'storeId', 'label', 'text', 'details'].includes(key)) {
                                detailsObj[key] = cleanItem[key];
                            }
                        });
                        mappedItem = {
                            id: cleanItem.id,
                            store_id: store.id,
                            label: cleanItem.label || '',
                            text: cleanItem.text || '',
                            details: detailsObj
                        };
                    } else if (table === 'orders') {
                        const firstClassColumns = [
                            'id', 'store_id', 'storeId',
                            'order_number', 'orderNumber',
                            'customer_name', 'customerName',
                            'customer_phone', 'customerPhone', 'customerPhone2',
                            'shipping_company', 'shippingCompany',
                            'status', 'date',
                            'total_price', 'totalPrice',
                            'shipping_fee', 'shippingFee',
                            'flexShipFee', 'flexShipCompanyFee',
                            'enableFlexShip', 'flexShipFeePaidByCustomer',
                            'channel', 'warehouse_id', 'warehouseId',
                            'advancePayment', 'advancePaymentPartnerId', 'advancePaymentTreasuryId',
                            'advancePaymentEmployeeId', 'advancePaymentRecipientPhone', 'advancePaymentSenderDetails',
                            'advancePaymentHistory', 'items', 'createdBy', 'source', 'vatOnStandardShipping',
                            'customerAddress', 'city', 'governorate', 'shippingArea', 'paymentMethod', 'paymentStatus',
                            'notes', 'discount', 'isInsured', 'includeInspectionFee', 'inspectionFeePaidByCustomer',
                            'recordedAsDebt', 'deferPaymentToReturn', 'returnCashToCustomer', 'cashToReturnAmount',
                            'creditAmount', 'totalAmountOverride', 'totalAmountOverrideReason', 'orderType', 'shipmentType',
                            'maintenanceCost', 'maintenanceItemDescription', 'maintenanceItemSerial', 'maintenanceItemValue',
                            'maintenanceTechnicalReport', 'maintenanceStatus', 'originalOrderId', 'exchangeDifference',
                            'returnProductValue', 'returnTrackingNumber',
                            'collectionProcessed', 'preparationStatus', 'classification', 'redeemedPoints', 'pointsDiscount',
                            'loyaltyPointsAwarded', 'stockDeducted', 'confirmationLogs', 'cancellationReason', 'followUpReminder',
                            'auditLogs', 'callAttempts',
                            'details'
                        ];

                        const detailsObj: any = {
                            ...(cleanItem.details || {})
                        };

                        Object.keys(cleanItem).forEach(key => {
                            if (key !== 'details') {
                                detailsObj[key] = cleanItem[key];
                            }
                        });

                        mappedItem = {
                            id: cleanItem.id,
                            store_id: store.id,
                            storeId: cleanItem.storeId || store.id,
                            order_number: cleanItem.orderNumber || cleanItem.order_number || '',
                            orderNumber: cleanItem.orderNumber || cleanItem.order_number || '',
                            customer_name: cleanItem.customerName || cleanItem.customer_name || '',
                            customerName: cleanItem.customerName || cleanItem.customer_name || '',
                            customer_phone: cleanItem.customerPhone || cleanItem.customer_phone || '',
                            customerPhone: cleanItem.customerPhone || cleanItem.customer_phone || '',
                            customerPhone2: cleanItem.customerPhone2 || null,
                            shipping_company: cleanItem.shippingCompany || cleanItem.shipping_company || '',
                            shippingCompany: cleanItem.shippingCompany || cleanItem.shipping_company || '',
                            status: cleanItem.status || '',
                            date: cleanItem.date || new Date().toISOString(),
                            total_price: Number(cleanItem.totalPrice ?? cleanItem.total_price ?? 0),
                            totalPrice: Number(cleanItem.totalPrice ?? cleanItem.total_price ?? 0),
                            shipping_fee: Number(cleanItem.shippingFee ?? cleanItem.shipping_fee ?? 0),
                            shippingFee: Number(cleanItem.shippingFee ?? cleanItem.shipping_fee ?? 0),
                            flexShipFee: cleanItem.flexShipFee !== undefined ? Number(cleanItem.flexShipFee) : null,
                            flexShipCompanyFee: cleanItem.flexShipCompanyFee !== undefined ? Number(cleanItem.flexShipCompanyFee) : null,
                            enableFlexShip: cleanItem.enableFlexShip !== undefined ? Boolean(cleanItem.enableFlexShip) : null,
                            flexShipFeePaidByCustomer: cleanItem.flexShipFeePaidByCustomer !== undefined ? Boolean(cleanItem.flexShipFeePaidByCustomer) : null,
                            channel: cleanItem.channel || null,
                            warehouse_id: cleanItem.warehouseId || cleanItem.warehouse_id || null,
                            warehouseId: cleanItem.warehouseId || cleanItem.warehouse_id || null,
                            advancePayment: cleanItem.advancePayment !== undefined ? Number(cleanItem.advancePayment) : null,
                            advancePaymentPartnerId: cleanItem.advancePaymentPartnerId || null,
                            advancePaymentTreasuryId: cleanItem.advancePaymentTreasuryId || null,
                            advancePaymentEmployeeId: cleanItem.advancePaymentEmployeeId || null,
                            advancePaymentRecipientPhone: cleanItem.advancePaymentRecipientPhone || null,
                            advancePaymentSenderDetails: cleanItem.advancePaymentSenderDetails || null,
                            advancePaymentHistory: cleanItem.advancePaymentHistory || [],
                            items: Array.isArray(cleanItem.items) ? cleanItem.items : [],
                            createdBy: cleanItem.createdBy || null,
                            source: cleanItem.source || null,
                            vatOnStandardShipping: cleanItem.vatOnStandardShipping ?? false,
                            customerAddress: cleanItem.customerAddress || null,
                            city: cleanItem.city || null,
                            governorate: cleanItem.governorate || null,
                            shippingArea: cleanItem.shippingArea || null,
                            paymentMethod: cleanItem.paymentMethod || null,
                            paymentStatus: cleanItem.paymentStatus || null,
                            notes: cleanItem.notes || null,
                            discount: Number(cleanItem.discount ?? 0),
                            isInsured: Boolean(cleanItem.isInsured ?? false),
                            includeInspectionFee: Boolean(cleanItem.includeInspectionFee ?? false),
                            inspectionFeePaidByCustomer: Boolean(cleanItem.inspectionFeePaidByCustomer ?? false),
                            recordedAsDebt: Boolean(cleanItem.recordedAsDebt ?? false),
                            deferPaymentToReturn: Boolean(cleanItem.deferPaymentToReturn ?? false),
                            returnCashToCustomer: Boolean(cleanItem.returnCashToCustomer ?? false),
                            cashToReturnAmount: Number(cleanItem.cashToReturnAmount ?? 0),
                            creditAmount: Number(cleanItem.creditAmount ?? 0),
                            totalAmountOverride: cleanItem.totalAmountOverride !== undefined ? Number(cleanItem.totalAmountOverride) : null,
                            totalAmountOverrideReason: cleanItem.totalAmountOverrideReason || null,
                            orderType: cleanItem.orderType || 'standard',
                            shipmentType: cleanItem.shipmentType || 'delivery',
                            maintenanceCost: cleanItem.maintenanceCost !== undefined ? Number(cleanItem.maintenanceCost) : null,
                            maintenanceItemDescription: cleanItem.maintenanceItemDescription || null,
                            maintenanceItemSerial: cleanItem.maintenanceItemSerial || null,
                            maintenanceItemValue: cleanItem.maintenanceItemValue !== undefined ? Number(cleanItem.maintenanceItemValue) : null,
                            maintenanceTechnicalReport: cleanItem.maintenanceTechnicalReport || null,
                            maintenanceStatus: cleanItem.maintenanceStatus || null,
                            originalOrderId: cleanItem.originalOrderId || null,
                            exchangeDifference: cleanItem.exchangeDifference !== undefined ? Number(cleanItem.exchangeDifference) : null,
                            returnProductValue: cleanItem.returnProductValue !== undefined ? Number(cleanItem.returnProductValue) : null,
                            returnTrackingNumber: cleanItem.returnTrackingNumber || null,
                            collectionProcessed: cleanItem.collectionProcessed !== undefined ? Boolean(cleanItem.collectionProcessed) : null,
                            preparationStatus: cleanItem.preparationStatus || null,
                            classification: cleanItem.classification || null,
                            redeemedPoints: cleanItem.redeemedPoints !== undefined ? Number(cleanItem.redeemedPoints) : null,
                            pointsDiscount: cleanItem.pointsDiscount !== undefined ? Number(cleanItem.pointsDiscount) : null,
                            loyaltyPointsAwarded: cleanItem.loyaltyPointsAwarded !== undefined ? Boolean(cleanItem.loyaltyPointsAwarded) : null,
                            stockDeducted: cleanItem.stockDeducted !== undefined ? Boolean(cleanItem.stockDeducted) : null,
                            confirmationLogs: cleanItem.confirmationLogs || [],
                            cancellationReason: cleanItem.cancellationReason || null,
                            followUpReminder: cleanItem.followUpReminder || null,
                            auditLogs: cleanItem.auditLogs || [],
                            callAttempts: cleanItem.callAttempts || [],
                            insuranceFee: cleanItem.insuranceFee !== undefined ? Number(cleanItem.insuranceFee) : (detailsObj.insuranceFee !== undefined ? Number(detailsObj.insuranceFee) : null),
                            inspectionFee: cleanItem.inspectionFee !== undefined ? Number(cleanItem.inspectionFee) : (detailsObj.inspectionFee !== undefined ? Number(detailsObj.inspectionFee) : null),
                            productPrice: cleanItem.productPrice !== undefined ? Number(cleanItem.productPrice) : (detailsObj.productPrice !== undefined ? Number(detailsObj.productPrice) : null),
                            productCost: cleanItem.productCost !== undefined ? Number(cleanItem.productCost) : (detailsObj.productCost !== undefined ? Number(detailsObj.productCost) : null),
                            merchantItemCost: cleanItem.merchantItemCost !== undefined ? Number(cleanItem.merchantItemCost) : (detailsObj.merchantItemCost !== undefined ? Number(detailsObj.merchantItemCost) : null),
                            merchantId: cleanItem.merchantId || detailsObj.merchantId || null,
                            merchantName: cleanItem.merchantName || detailsObj.merchantName || null,
                            settlementStatus: cleanItem.settlementStatus || detailsObj.settlementStatus || 'unsettled',
                            settlementId: cleanItem.settlementId || detailsObj.settlementId || null,
                            serviceFeePerOrder: cleanItem.serviceFeePerOrder !== undefined ? Number(cleanItem.serviceFeePerOrder) : (detailsObj.serviceFeePerOrder !== undefined ? Number(detailsObj.serviceFeePerOrder) : null),
                            marketingFeePerOrder: cleanItem.marketingFeePerOrder !== undefined ? Number(cleanItem.marketingFeePerOrder) : (detailsObj.marketingFeePerOrder !== undefined ? Number(detailsObj.marketingFeePerOrder) : null),
                            merchantSettlementMode: cleanItem.merchantSettlementMode || detailsObj.merchantSettlementMode || null,
                            merchantProfitSharePercent: cleanItem.merchantProfitSharePercent !== undefined ? Number(cleanItem.merchantProfitSharePercent) : (detailsObj.merchantProfitSharePercent !== undefined ? Number(detailsObj.merchantProfitSharePercent) : null),
                            vatValue: cleanItem.vatValue !== undefined ? Number(cleanItem.vatValue) : (detailsObj.vatValue !== undefined ? Number(detailsObj.vatValue) : null),
                            details: detailsObj
                        };
                    } else if (table === 'warehouses') {
                        mappedItem = {
                            ...cleanItem,
                            id: cleanItem.id,
                            store_id: store.id,
                            storeId: cleanItem.storeId || store.id,
                            name: cleanItem.name || '',
                            location: cleanItem.location || '',
                            is_default: Boolean(cleanItem.isDefault ?? cleanItem.is_default ?? false),
                            isDefault: Boolean(cleanItem.isDefault ?? cleanItem.is_default ?? false)
                        };
                    } else if (table === 'inventory_audits') {
                        mappedItem = {
                            ...cleanItem,
                            id: cleanItem.id,
                            store_id: store.id,
                            storeId: cleanItem.storeId || store.id,
                            title: cleanItem.title || '',
                            date: cleanItem.date || '',
                            performed_by: cleanItem.performedBy || cleanItem.performed_by || '',
                            performedBy: cleanItem.performedBy || cleanItem.performed_by || '',
                            scope: cleanItem.scope || '',
                            warehouse_id: cleanItem.warehouseId || cleanItem.warehouse_id || '',
                            warehouseId: cleanItem.warehouseId || cleanItem.warehouse_id || '',
                            total_system_qty: Number(cleanItem.totalSystemQty ?? cleanItem.total_system_qty ?? 0),
                            totalSystemQty: Number(cleanItem.totalSystemQty ?? cleanItem.total_system_qty ?? 0),
                            total_actual_qty: Number(cleanItem.totalActualQty ?? cleanItem.total_actual_qty ?? 0),
                            totalActualQty: Number(cleanItem.totalActualQty ?? cleanItem.total_actual_qty ?? 0),
                            total_variance_qty: Number(cleanItem.totalVarianceQty ?? cleanItem.total_variance_qty ?? 0),
                            totalVarianceQty: Number(cleanItem.totalVarianceQty ?? cleanItem.total_variance_qty ?? 0),
                            total_variance_value: Number(cleanItem.totalVarianceValue ?? cleanItem.total_variance_value ?? 0),
                            totalVarianceValue: Number(cleanItem.totalVarianceValue ?? cleanItem.total_variance_value ?? 0),
                            total_items_audited: Number(cleanItem.totalItemsAudited ?? cleanItem.total_items_audited ?? 0),
                            totalItemsAudited: Number(cleanItem.totalItemsAudited ?? cleanItem.total_items_audited ?? 0),
                            timestamp: cleanItem.timestamp ? Number(cleanItem.timestamp) : undefined,
                            discrepancies: Array.isArray(cleanItem.discrepancies) ? cleanItem.discrepancies : [],
                            notes: cleanItem.notes || ''
                        };
                    } else if (table === 'stock_transfers') {
                        mappedItem = {
                            ...cleanItem,
                            id: cleanItem.id,
                            store_id: store.id,
                            storeId: cleanItem.storeId || store.id,
                            transfer_number: cleanItem.transferNumber || cleanItem.transfer_number || '',
                            transferNumber: cleanItem.transferNumber || cleanItem.transfer_number || '',
                            date: cleanItem.date || '',
                            source_warehouse_id: cleanItem.sourceWarehouseId || cleanItem.source_warehouse_id || '',
                            sourceWarehouseId: cleanItem.sourceWarehouseId || cleanItem.source_warehouse_id || '',
                            destination_warehouse_id: cleanItem.destinationWarehouseId || cleanItem.destination_warehouse_id || '',
                            destinationWarehouseId: cleanItem.destinationWarehouseId || cleanItem.destination_warehouse_id || '',
                            items: Array.isArray(cleanItem.items) ? cleanItem.items : [],
                            status: cleanItem.status || 'pending',
                            notes: cleanItem.notes || '',
                            performed_by: cleanItem.performedBy || cleanItem.performed_by || '',
                            performedBy: cleanItem.performedBy || cleanItem.performed_by || '',
                            cancelled_at: cleanItem.cancelledAt || cleanItem.cancelled_at || null,
                            cancelledAt: cleanItem.cancelledAt || cleanItem.cancelled_at || null,
                            cancelled_by: cleanItem.cancelledBy || cleanItem.cancelled_by || null,
                            cancelledBy: cleanItem.cancelledBy || cleanItem.cancelled_by || null,
                            cancellation_reason: cleanItem.cancellationReason || cleanItem.cancellation_reason || null,
                            cancellationReason: cleanItem.cancellationReason || cleanItem.cancellation_reason || null
                        };
                    } else if (table === 'order_returns') {
                        mappedItem = {
                            ...cleanItem,
                            id: cleanItem.id,
                            store_id: store.id,
                            storeId: cleanItem.storeId || store.id,
                            return_number: cleanItem.returnNumber || cleanItem.return_number || '',
                            returnNumber: cleanItem.returnNumber || cleanItem.return_number || '',
                            order_id: cleanItem.orderId || cleanItem.order_id || '',
                            orderId: cleanItem.orderId || cleanItem.order_id || '',
                            order_number: cleanItem.orderNumber || cleanItem.order_number || '',
                            orderNumber: cleanItem.orderNumber || cleanItem.order_number || '',
                            date: cleanItem.date || '',
                            items: Array.isArray(cleanItem.items) ? cleanItem.items : [],
                            total_refund: Number(cleanItem.totalRefund ?? cleanItem.total_refund ?? 0),
                            totalRefund: Number(cleanItem.totalRefund ?? cleanItem.total_refund ?? 0),
                            reason: cleanItem.reason || '',
                            warehouse_id: cleanItem.warehouseId || cleanItem.warehouse_id || '',
                            warehouseId: cleanItem.warehouseId || cleanItem.warehouse_id || '',
                            restock_items: Boolean(cleanItem.restockItems ?? cleanItem.restock_items ?? true),
                            restockItems: Boolean(cleanItem.restockItems ?? cleanItem.restock_items ?? true),
                            status: cleanItem.status || 'completed',
                            performed_by: cleanItem.performedBy || cleanItem.performed_by || '',
                            performedBy: cleanItem.performedBy || cleanItem.performed_by || '',
                            notes: cleanItem.notes || ''
                        };
                    } else if (table === 'purchase_returns') {
                        mappedItem = {
                            ...cleanItem,
                            id: cleanItem.id,
                            store_id: store.id,
                            storeId: cleanItem.storeId || store.id,
                            return_number: cleanItem.returnNumber || cleanItem.return_number || '',
                            returnNumber: cleanItem.returnNumber || cleanItem.return_number || '',
                            supplier_id: cleanItem.supplierId || cleanItem.supplier_id || '',
                            supplierId: cleanItem.supplierId || cleanItem.supplier_id || '',
                            supplier_name: cleanItem.supplierName || cleanItem.supplier_name || '',
                            supplierName: cleanItem.supplierName || cleanItem.supplier_name || '',
                            date: cleanItem.date || '',
                            items: Array.isArray(cleanItem.items) ? cleanItem.items : [],
                            total_refund_amount: Number(cleanItem.totalRefundAmount ?? cleanItem.total_refund_amount ?? 0),
                            totalRefundAmount: Number(cleanItem.totalRefundAmount ?? cleanItem.total_refund_amount ?? 0),
                            warehouse_id: cleanItem.warehouseId || cleanItem.warehouse_id || '',
                            warehouseId: cleanItem.warehouseId || cleanItem.warehouse_id || '',
                            status: cleanItem.status || 'completed',
                            performed_by: cleanItem.performedBy || cleanItem.performed_by || '',
                            performedBy: cleanItem.performedBy || cleanItem.performed_by || '',
                            notes: cleanItem.notes || ''
                        };
                    } else if (table === 'pos_sales') {
                        mappedItem = {
                            ...cleanItem,
                            id: cleanItem.id,
                            store_id: store.id,
                            storeId: cleanItem.storeId || store.id,
                            sale_number: cleanItem.saleNumber || cleanItem.sale_number || '',
                            saleNumber: cleanItem.saleNumber || cleanItem.sale_number || '',
                            date: cleanItem.date || '',
                            items: Array.isArray(cleanItem.items) ? cleanItem.items : [],
                            total_amount: Number(cleanItem.totalAmount ?? cleanItem.total_amount ?? 0),
                            totalAmount: Number(cleanItem.totalAmount ?? cleanItem.total_amount ?? 0),
                            payment_method: cleanItem.paymentMethod || cleanItem.payment_method || '',
                            paymentMethod: cleanItem.paymentMethod || cleanItem.payment_method || '',
                            warehouse_id: cleanItem.warehouseId || cleanItem.warehouse_id || '',
                            warehouseId: cleanItem.warehouseId || cleanItem.warehouse_id || '',
                            customer_phone: cleanItem.customerPhone || cleanItem.customer_phone || '',
                            customerPhone: cleanItem.customerPhone || cleanItem.customer_phone || '',
                            customer_name: cleanItem.customerName || cleanItem.customer_name || '',
                            customerName: cleanItem.customerName || cleanItem.customer_name || '',
                            customer_address: cleanItem.customerAddress || cleanItem.customer_address || '',
                            customerAddress: cleanItem.customerAddress || cleanItem.customer_address || '',
                            performed_by: cleanItem.performedBy || cleanItem.performed_by || '',
                            performedBy: cleanItem.performedBy || cleanItem.performed_by || ''
                        };
                    } else if (table === 'shipping_integrations') {
                        mappedItem = {
                            ...cleanItem,
                            id: cleanItem.id,
                            store_id: store.id,
                            storeId: cleanItem.storeId || store.id,
                            provider: cleanItem.provider || '',
                            api_key: cleanItem.apiKey || cleanItem.api_key || '',
                            apiKey: cleanItem.apiKey || cleanItem.api_key || '',
                            api_secret: cleanItem.apiSecret || cleanItem.api_secret || '',
                            apiSecret: cleanItem.apiSecret || cleanItem.api_secret || '',
                            account_number: cleanItem.accountNumber || cleanItem.account_number || '',
                            accountNumber: cleanItem.accountNumber || cleanItem.account_number || '',
                            is_connected: Boolean(cleanItem.isConnected ?? cleanItem.is_connected ?? false),
                            isConnected: Boolean(cleanItem.isConnected ?? cleanItem.is_connected ?? false),
                            created_at: cleanItem.createdAt || cleanItem.created_at || new Date().toISOString(),
                            updated_at: cleanItem.updatedAt || cleanItem.updated_at || new Date().toISOString(),
                            details: cleanItem.details || {}
                        };
                    }
                    
                    return mappedItem;
                }).filter(item => {
                    if (table === 'employees' && !item.phone) {
                        return false; 
                    }
                    if (table === 'cash_holders' && (!item.user_id || item.user_id === 'undefined')) {
                        return false;
                    }
                    if (table === 'cash_handovers' && !item.id) {
                        return false;
                    }
                    if (table === 'partners' && !item.id) {
                        return false;
                    }
                    return true;
                });

                // Deduplicate by the table's specific unique/primary key
                const map = new Map<string, any>();
                for (const item of itemsFiltered) {
                    let key = '';
                    if (table === 'employees') {
                        key = String(item.phone || '');
                    } else if (table === 'cash_holders') {
                        key = String(item.user_id || item.userId || item.id || '');
                    } else {
                        key = String(item.id || '');
                    }
                    if (key) {
                        map.set(key, item);
                    }
                }
                const uniqueItems = Array.from(map.values());
                
                let currentItemsToUpsert = uniqueItems.map(item => {
                    const copy = { ...item };
                    for (const key of Object.keys(copy)) {
                        if (knownMissingColumns.has(`${table}:${key}`)) {
                            delete copy[key];
                        }
                    }
                    return copy;
                });
                let upsertSuccess = false;
                let attempts = 0;
                
                while (!upsertSuccess && attempts < 30) {
                    try {
                        const { error } = await supabase.from(table).upsert(currentItemsToUpsert);
                        if (!error) {
                            upsertSuccess = true;
                            if ((window as any).SUPABASE_SCHEMA_ERROR?.table === table) {
                                delete (window as any).SUPABASE_SCHEMA_ERROR;
                            }
                            break;
                        }
                        
                        if (error.code === 'PGRST205' || error.code === 'PGRST116') {
                            if (['orders', 'products', 'transactions'].includes(table) && currentItemsToUpsert.length > 0) {
                                throw error;
                            }
                            knownMissingTables.add(table);
                            try {
                                if (typeof window !== 'undefined') {
                                    localStorage.setItem('supabase_missing_tables', JSON.stringify(Array.from(knownMissingTables)));
                                }
                            } catch (e) {}
                            return;
                        }
                        
                        if (error.code === 'PGRST204') {
                            // Parse missing column name
                            const msg = error.message || '';
                            const match = msg.match(/Could not find the '([^']+)' column/i) || 
                                          msg.match(/column "([^"]+)"/i) ||
                                          msg.match(/column '([^']+)'/i);
                                          
                            if (match && match[1]) {
                                const missingCol = match[1];
                                knownMissingColumns.add(`${table}:${missingCol}`);
                                try {
                                    if (typeof window !== 'undefined') {
                                        localStorage.setItem('supabase_missing_columns', JSON.stringify(Array.from(knownMissingColumns)));
                                    }
                                } catch (e) {}
                                currentItemsToUpsert = currentItemsToUpsert.map(item => {
                                    const copy = { ...item };
                                    if (copy.details && typeof copy.details === 'object') {
                                        copy.details = { ...copy.details, [missingCol]: item[missingCol] };
                                    } else if (['orders', 'products', 'supply_orders', 'transactions', 'payment_methods', 'stores_data', 'whatsapp_templates', 'shipping_integrations', 'partners'].includes(table)) {
                                        copy.details = { [missingCol]: item[missingCol] };
                                    }
                                    delete copy[missingCol];
                                    return copy;
                                });
                                attempts++;
                                continue;
                            }

                                // Record schema error only if self-healing wasn't possible
                            (window as any).SUPABASE_SCHEMA_ERROR = {
                                table,
                                message: error.message,
                                code: error.code
                            };
                        }

                        // 4. Handle Deadlocks (40P01) or Lock Failures (55P03)
                        if (error.code === '40P01' || error.code === '55P03' || (error.message || '').toLowerCase().includes('deadlock detected')) {
                            console.warn(`[SYNC-RETRY] Deadlock or lock failure on table ${table}. Retrying in ${attempts * 200}ms...`);
                            attempts++;
                            // Randomized exponential backoff to reduce collision probability
                            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 500) + (attempts * 200)));
                            continue;
                        }

                        // Self-heal PostgreSQL foreign key constraint violations (23503) e.g. supply_orders_supplier_id_fkey
                        if (error.code === '23503' || (error.message || '').includes('violates foreign key constraint')) {
                            const fkMsg = error.message || '';
                            console.warn(`[SYNC-SELF-HEAL] Foreign key violation on table ${table}: ${fkMsg}. Attempting fallback to details...`);
                            
                            if (table === 'supply_orders' || fkMsg.includes('supplier_id')) {
                                currentItemsToUpsert = currentItemsToUpsert.map(item => {
                                    const copy = { ...item };
                                    const origSup = copy.supplier_id || copy.supplierId;
                                    if (origSup) {
                                        copy.details = (copy.details && typeof copy.details === 'object')
                                            ? { ...copy.details, supplierId: origSup }
                                            : { supplierId: origSup };
                                    }
                                    copy.supplier_id = null;
                                    // Also set supplierId to null to be safe if that's the column name in Postgres
                                    if (copy.supplierId !== undefined) copy.supplierId = null;
                                    return copy;
                                });
                                attempts++;
                                continue;
                            }
                            if (table === 'reviews' || fkMsg.includes('product_id')) {
                                currentItemsToUpsert = currentItemsToUpsert.map(item => ({
                                    ...item,
                                    product_id: null,
                                    productId: null
                                }));
                                attempts++;
                                continue;
                            }
                        }
                        
                        throw error;
                    } catch (upsertErr: any) {
                        const isNetworkErr = upsertErr?.message?.includes('Failed to fetch') || 
                                             upsertErr?.name === 'TypeError' || 
                                             upsertErr?.message?.includes('NetworkError');
                        if (isNetworkErr) {
                            console.warn(`[SUPABASE-SYNC] Network fetch failed for table ${table}:`, upsertErr?.message || upsertErr);
                            throw upsertErr;
                        }
                        throw upsertErr;
                    }
                }
                if (upsertSuccess) syncFingerprints.set(fingerprintKey, fingerprint);
            };

            // Parallel sync with individual error handling to ensure one table error (like missing column) 
            // doesn't block other tables (like employees) from syncing.
            const tablesToSync = [
                () => syncTable('products', products, ['updatedAt']),
                () => syncTable('orders', orders),
                () => syncTable('transactions', wallet.transactions),
                async () => {
                    await syncTable('treasury_accounts', treasury?.accounts || []);
                    await syncTable('treasury_transactions', treasury?.transactions || []);
                },
                async () => {
                    await syncTable('suppliers', suppliers);
                    await syncTable('supply_orders', supplyOrders);
                },
                () => syncTable('reviews', reviews),
                () => syncTable('abandoned_carts', abandonedCarts),
                () => syncTable('activity_logs', activityLogs || []),
                () => syncTable('employees', employees, ['id', 'updatedAt', 'isPartner', 'partnerId', 'role']),
                () => syncTable('discount_codes', discountCodes),
                () => syncTable('collections', collections),
                () => syncTable('custom_pages', customPages, ['isActive', 'updatedAt']),
                () => syncTable('payment_methods', paymentMethods),
                () => syncTable('customers', customers),
                () => syncTable('global_options', globalOptions),
                () => syncTable('shipping_integrations', shippingIntegrations),
                async () => {
                    await syncTable('partners', partners || [], [
                        'permissions', 'portalPermissions', 'payoutAccounts', 
                        'isEmailVerified', 'is_email_verified', 'emailVerifiedAt', 'email_verified_at',
                        'lastLoginAt', 'last_login_at', 'employeeId', 'employee_id',
                        'email', 'passcode', 'password', 'requireEmailOtp', 'require_email_otp',
                        'biometricCredentials', 'biometric_credentials', 'allowBiometricAuth', 'allow_biometric_auth'
                    ]);
                    await syncTable('partner_transactions', partnerTransactions || []);
                },
                async () => {
                    await syncTable('warehouses', warehouses || []);
                    await syncTable('stock_transfers', stockTransfers || []);
                },
                () => syncTable('inventory_audits', inventoryAudits || []),
                () => syncTable('order_returns', orderReturns || []),
                () => syncTable('purchase_returns', purchaseReturns || []),
                () => syncTable('pos_sales', posSales || []),
                async () => {
                    await syncTable('cash_holders', cashHolders || []);
                    await syncTable('cash_handovers', cashHandovers || []);
                },
                () => syncTable('whatsapp_templates', whatsappTemplates || []),
                () => syncTable('call_scripts', callScripts || []),
                () => syncTable('quotations', data.quotations || []),
                () => syncTable('chat_messages', [])
            ];

            const syncErrors: any[] = [];
            await Promise.all(tablesToSync.map(async (fn) => {
                try {
                    await fn();
                } catch (e: any) {
                    const isRls = e?.message?.toLowerCase?.().includes('row-level security') || e?.code === '42501';
                    const isNet = e?.message?.includes('Failed to fetch') || e?.name === 'TypeError';
                    syncErrors.push(e);
                    if (!isNet && !isRls) {
                        console.warn(`Table sync warning:`, e?.message || e);
                    }
                }
            }));

            if (syncErrors.length > 0) {
                const isRestrictedError = syncErrors.some(e => isRestrictionError(e));
                if (isRestrictedError) {
                    console.warn('[SUPABASE-SYNC] Quota/restriction violations detected during table sync. Falling back to native Firebase Firestore.');
                    setSupabaseRestricted(true);
                    // Do not return error; break out to native Firebase Firestore sync below
                } else {
                    const isSchemaError = syncErrors.some(e => e.code === 'PGRST204');
                    const isNetworkError = syncErrors.every(e => e?.message?.includes('Failed to fetch') || e?.name === 'TypeError');
                    
                    if (isNetworkError) {
                        console.warn('[SUPABASE-SYNC] Supabase is offline or unreachable. Keeping the write local; Firebase fallback is disabled while Supabase is active.');
                        return { success: false, error: 'تعذر الاتصال بقاعدة البيانات الأساسية. تم الاحتفاظ بالتعديلات محليًا ولن يتم إرسالها إلى مصدر آخر.' };
                    } else {
                        const isRlsError = syncErrors.some(e => e?.message?.toLowerCase?.().includes('row-level security') || e?.code === '42501');
                        if (isRlsError) {
                            return {
                                success: false,
                                error: 'حدث خطأ في صلاحيات الجداول (RLS). يرجى نسخ سكربت قاعدة البيانات من إعدادات المطور وتشغيله في Supabase SQL Editor لتعطيل الحماية وتفعيل المزامنة.'
                            };
                        }
                        return { 
                            success: false, 
                            error: isSchemaError 
                                ? `كود الخطأ PGRST204: هناك أعمدة مفقودة في قاعدة البيانات (مثل minStockLevel). يرجى الضغط على زر "إصلاح الأعمدة المفقودة" في إعدادات المطورين.` 
                                : (syncErrors[0]?.message || 'Sync error')
                        };
                    }
                }
            } else {
                supabaseSaveSucceeded = true;
            }

            if (supabaseSaveSucceeded) {
                return { success: true };
            }
        } catch (e: any) {
            if (isRestrictionError(e)) {
                console.warn('[SUPABASE-SYNC] Supabase egress quota exceeded or project restricted. Automatically falling back to native Firebase Firestore:', e?.message || e);
                setSupabaseRestricted(true);
                // Do not return error! Let execution continue downwards to native Firebase Firestore sync so data is safely saved!
            } else {
                const isNet = e?.message?.includes('Failed to fetch') || e?.name === 'TypeError';
                if (isNet) {
                    console.warn('[SUPABASE-SYNC] Supabase unreachable on save. Firebase fallback is disabled while Supabase is active:', e?.message || e);
                    return { success: false, error: 'تعذر الاتصال بقاعدة البيانات الأساسية. تم الاحتفاظ بالتعديلات محليًا.' };
                } else {
                    console.error('Supabase save failed', e);
                    return { success: false, error: e.message };
                }
            }
        }
    }

    const operationId = generateUniqueOrderId('sync');
    const failedCollections: string[] = [];
    const conflicts: Array<{
        collection: string;
        docId: string;
        reason: string;
        cloudUpdatedAt?: string;
        localUpdatedAt?: string;
    }> = [];
    let reconciledCloudOrders: any[] = data.orders || [];

    try {
        await ensureStoreRecordExists(store.id, store.name);

        const syncCollection = async (collectionName: string, rawStateItems: any[], idField = 'id') => {
            try {
                const stateItems = Array.isArray(rawStateItems) ? rawStateItems : (rawStateItems && typeof rawStateItems === 'object' ? Object.values(rawStateItems) : []);
                const hashKey = `${store.id}_${collectionName}`;
                const currentHash = getCollectionHash(stateItems);
                if (LAST_SYNCED_HASHES[hashKey] === currentHash) {
                    return;
                }

                let snap = await getDocs(query(collection(firebaseDb, collectionName), where('storeId', '==', store.id)));
                if (snap.empty) {
                    snap = await getDocs(query(collection(firebaseDb, collectionName), where('store_id', '==', store.id)));
                }
                
                const existingDbDocs = snap.docs.map(doc => ({ _ref: doc.ref, id: doc.id, ...doc.data() }) as any);
                const existingDocsMap = new Map<string, any>(existingDbDocs.map(doc => [doc.id as string, doc]));

                if (collectionName === 'orders') {
                    const rec = reconcileDualOrderSources(store.id, stateItems, existingDbDocs, EXPLICIT_DELETED_IDS);
                    reconciledCloudOrders = rec.mergedOrders;
                }

                const conflictStrategy = ((typeof window !== 'undefined' ? localStorage.getItem('syncConflictStrategy') : 'last_write_wins') || 'last_write_wins') as 'last_write_wins' | 'cloud_wins' | 'local_wins';

                let collectionHadWriteError = false;

                const upsertPromises = stateItems.map(async (item) => {
                    const baseId = String(item[idField] || item.phone || item.id);
                    const docId = baseId.startsWith(store.id) ? baseId : `${store.id}_${baseId}`;
                    const docRef = doc(firebaseDb, collectionName, docId);
                    
                    const existingDoc = existingDocsMap.get(docId);
                    const nowISO = new Date().toISOString();

                    const decision = evaluateRecordUpsert({
                        localItem: item,
                        existingCloudDoc: existingDoc,
                        conflictStrategy,
                        nowISO
                    });

                    if (decision.isConflict) {
                        conflicts.push({
                            collection: collectionName,
                            docId,
                            reason: decision.conflictReason || 'CONFLICT',
                            cloudUpdatedAt: existingDoc?.updatedAt,
                            localUpdatedAt: item?.updatedAt
                        });
                    }

                    if (decision.shouldUpdateCloud) {
                        const payload = cleanUndefined({ ...decision.itemToWrite, storeId: store.id, store_id: store.id });
                        await setDoc(docRef, payload, { merge: true }).catch(err => {
                            collectionHadWriteError = true;
                            if (err?.code === 'resource-exhausted') {
                                throw new Error('QUOTA_EXCEEDED');
                            }
                            handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${docId}`);
                        });
                    }
                });

                const isMassDeletionRisk = (stateItems.length === 0 && existingDbDocs.length > 1);
                if (isMassDeletionRisk) {
                    console.warn(`[SYNC-SAFEGUARD] Skipped deletion for collection "${collectionName}" because incoming array is empty but Firestore has ${existingDbDocs.length} records.`);
                }

                // STRICT ANTI-DATA-LOSS SAFEGUARD (Audit Fix #2):
                // Inferred deletion from missing local array items (`wasKnownLocally && isMissingLocally`) is completely disabled.
                // Deletion is ONLY permitted when explicitly authorized in EXPLICIT_DELETED_IDS and allowed by shouldDeleteCloudRecord.
                // UNWANTED MOCK SEED PURGE: Dummy mock suppliers (شركة النور / مؤسسة الأمانة) are always purged permanently.
                if (collectionName === 'suppliers') {
                    existingDbDocs.forEach(d => {
                        if (isDummyMockSupplier(d)) {
                            deleteDoc(d._ref).catch(() => {});
                            const rawId = d.id.startsWith(store.id + '_') ? d.id.substring(store.id.length + 1) : d.id;
                            recordExplicitDeletion(`${store.id}_suppliers_${d.id}`);
                            recordExplicitDeletion(`${store.id}_suppliers_${rawId}`);
                        }
                    });
                }

                const deletePromises = isMassDeletionRisk
                    ? []
                    : existingDbDocs
                        .filter(doc => {
                            if (collectionName === 'suppliers' && isDummyMockSupplier(doc)) {
                                return true;
                            }
                            const rawId = doc.id.startsWith(store.id + '_') ? doc.id.substring(store.id.length + 1) : doc.id;
                            const isExplicitlyDeleted =
                                EXPLICIT_DELETED_IDS.has(`${store.id}_${collectionName}_${doc.id}`) ||
                                EXPLICIT_DELETED_IDS.has(`${store.id}_${collectionName}_${rawId}`);

                            return shouldDeleteCloudRecord({
                                collectionName,
                                isExplicitlyDeleted
                            }).allowDelete;
                        })
                        .map(async (doc) => {
                            await deleteDoc(doc._ref).catch(err => {
                                collectionHadWriteError = true;
                                if (err?.code === 'resource-exhausted') {
                                    throw new Error('QUOTA_EXCEEDED');
                                }
                                handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${doc.id}`);
                            });
                        });

                await Promise.all([...upsertPromises, ...deletePromises]);

                if (!collectionHadWriteError) {
                    LAST_SYNCED_HASHES[hashKey] = currentHash;
                    saveSyncedHashes();
                    LAST_KNOWN_DOC_IDS[hashKey] = new Set(stateItems.map(item => {
                        const baseId = String(item[idField] || item.phone || item.id);
                        return baseId.startsWith(store.id) ? baseId : `${store.id}_${baseId}`;
                    }));
                } else {
                    failedCollections.push(collectionName);
                }
            } catch (err: any) {
                failedCollections.push(collectionName);
                if (err.message === 'QUOTA_EXCEEDED' || err?.code === 'resource-exhausted') throw new Error('QUOTA_EXCEEDED');
                console.error(`Error syncing collection ${collectionName}:`, err);
            }
        };

        await Promise.all([
            syncCollection('products', products),
            syncCollection('orders', orders),
            syncCollection('transactions', wallet.transactions),
            syncCollection('treasury_accounts', treasury.accounts),
            syncCollection('treasury_transactions', treasury.transactions),
            syncCollection('suppliers', suppliers),
            syncCollection('supply_orders', supplyOrders),
            syncCollection('reviews', reviews),
            syncCollection('abandoned_carts', abandonedCarts),
            syncCollection('employees', employees, 'phone'),
            syncCollection('discount_codes', discountCodes),
            syncCollection('collections', collections),
            syncCollection('custom_pages', customPages),
            syncCollection('payment_methods', paymentMethods),
            syncCollection('customers', customers),
            syncCollection('global_options', globalOptions),
            syncCollection('shipping_integrations', shippingIntegrations),
            syncCollection('partners', partners),
            syncCollection('partner_transactions', partnerTransactions),
            syncCollection('warehouses', warehouses),
            syncCollection('inventory_audits', inventoryAudits),
            syncCollection('stock_transfers', stockTransfers),
            syncCollection('order_returns', orderReturns),
            syncCollection('purchase_returns', purchaseReturns),
            syncCollection('pos_sales', posSales),
            syncCollection('cash_holders', cashHolders, 'userId'),
            syncCollection('cash_handovers', cashHandovers),
            syncCollection('whatsapp_templates', whatsappTemplates),
            syncCollection('call_scripts', callScripts),
            syncCollection('quotations', data.quotations || [])
        ]);

        const storeRef = doc(firebaseDb, 'stores_data', store.id);
        const storePayload = cleanUndefined({ 
            settings: cleanSettingsFinal, 
            name: store.name,
            orders: reconciledCloudOrders,
            treasury: data.treasury || { accounts: [], transactions: [] },
            wallet: data.wallet || { balance: 0, transactions: [] },
            quotations: data.quotations || []
        });
        await WITH_TIMEOUT(setDoc(storeRef, storePayload, { merge: true })).catch(err => {
            if (err?.code === 'resource-exhausted') {
                throw new Error('QUOTA_EXCEEDED');
            }
            handleFirestoreError(err, OperationType.WRITE, `stores_data/${store.id}`);
            throw err;
        });

        if (failedCollections.length > 0) {
            return {
                success: false,
                status: 'failed',
                operationId,
                failedCollections,
                conflicts,
                error: `فشل مزامنة بعض المجموعات السحابية: ${failedCollections.join(', ')}`
            } as SaveStoreDataResult;
        }

        if (conflicts.length > 0) {
            return {
                success: true,
                status: 'conflict',
                operationId,
                conflicts
            } as SaveStoreDataResult;
        }

        return {
            success: true,
            status: 'committed',
            operationId
        } as SaveStoreDataResult;
    } catch (err: any) {
        if (err.message === 'QUOTA_EXCEEDED' || err.message?.includes('resource-exhausted') || err.message?.includes('quota')) {
            if (typeof window !== 'undefined') {
                localStorage.setItem('firestore_quota_exceeded', 'true');
            }
            console.warn('[PENDING_SYNC] Firestore quota exceeded. Data saved locally to IndexedDB only (pending cloud sync).');
            return {
                success: false,
                status: 'pending_sync',
                operationId,
                error: 'QUOTA_EXCEEDED: تم الحفظ محلياً في طابور المزامنة بسبب تجاوز حصة السحابة المؤقتة، ولم يتم التأكيد على الخادم بعد.'
            } as SaveStoreDataResult;
        }
        return {
            success: false,
            status: 'failed',
            operationId,
            failedCollections,
            error: err.message
        } as SaveStoreDataResult;
    }
};

export const getGlobalData = async (forceRemote: boolean = false): Promise<{ users: User[], loyaltyData: any } | null> => {
    const isBrowser = typeof window !== 'undefined';
    const savedSyncMode = isBrowser ? localStorage.getItem('dbSyncMode') : 'auto';
    const shouldForce = forceRemote || (savedSyncMode === 'auto');

    const local = await getLocal('global');
    if (!forceRemote && local && local.users && local.users.length > 0) {
        return local;
    }

    try {
        const queryUsers = collection(firebaseDb, 'users');
        let dbUsers: User[] = [];
        let hasPermission = true;
        try {
            const snap = await getDocs(queryUsers);
            dbUsers = snap.docs.map(doc => {
                const data = doc.data();
                return {
                    fullName: data.fullName || '',
                    phone: doc.id,
                    email: data.email || '',
                    stores: data.stores || [],
                    sites: data.sites || [],
                    isAdmin: data.isAdmin || false,
                    isBanned: data.isBanned || false,
                    joinDate: data.joinDate || ''
                };
            });
        } catch (err: any) {
            if (err?.code === 'permission-denied') {
                hasPermission = false;
                console.warn('[DATABASE-SERVICE] Permission denied fetching users. Returning empty users list (expected for non-admins).');
            } else {
                handleFirestoreError(err, OperationType.LIST, 'users');
                throw err;
            }
        }

        let supabaseUsers: User[] = [];
        const supabase = getSupabaseClient();
        if (supabase) {
            try {
                const { data: sbUsers, error: sbErr } = await supabase.from('users').select('*');
                if (!sbErr && sbUsers) {
                    supabaseUsers = sbUsers.map((su: any) => ({
                        fullName: su.full_name || '',
                        phone: su.phone,
                        password: su.password || '',
                        email: su.email || '',
                        stores: su.stores || [],
                        sites: su.sites || [],
                        isAdmin: su.is_admin || false,
                        isBanned: su.is_banned || false,
                        joinDate: su.join_date || ''
                    }));
                } else if (sbErr) {
                    console.warn('[DATABASE-SERVICE] Failed to fetch users from Supabase:', sbErr);
                }
            } catch (err) {
                console.error('[DATABASE-SERVICE] Error fetching from Supabase users table:', err);
            }
        }

        const localGlobal = await getLocal('global');
        const localUsers: User[] = localGlobal?.users || [];

        const mergedUsersMap = new Map<string, User>();
        localUsers.forEach(u => { if (u && u.phone) mergedUsersMap.set(u.phone, u); });
        dbUsers.forEach(u => { if (u && u.phone) mergedUsersMap.set(u.phone, u); });
        supabaseUsers.forEach(u => { if (u && u.phone) mergedUsersMap.set(u.phone, u); });

        const finalUsers = Array.from(mergedUsersMap.values());

        // Note: We no longer auto-create or auto-upload unauthenticated users into Firestore to comply with security rules and Auth requirements.

        const globalData = { users: finalUsers, loyaltyData: {} } as { users: User[], loyaltyData: any };
        await saveLocal('global', globalData);
        return globalData;
    } catch (err: any) {
        return await getLocal('global') as { users: User[], loyaltyData: any } | null;
    }
};

export const saveGlobalData = async (data: { users: User[], loyaltyData: any }): Promise<{ success: boolean, error?: string }> => {
    await saveLocal('global', data);
    try {
        if (!auth.currentUser) {
            console.log('[AUTH GUARD] Skipping Firestore saveGlobalData user operations because user is not authenticated.');
            return { success: true };
        }

        const me = data.users.find(u => auth.currentUser?.email?.replace("@mystore-auth.app", "") === u.phone);
        const amIAdmin = me?.isAdmin || false;

        const savePromises = data.users.map(async (u) => {
            if (!u.phone) return;
            
            // Only allow saving the current user or any user if current user is admin
            const isMe = auth.currentUser?.email?.replace("@mystore-auth.app", "") === u.phone;
            
            if (!isMe && !amIAdmin) {
                return;
            }

            const userRef = doc(firebaseDb, 'users', u.phone);

            // Double check that user document already exists in Firestore before updating.
            // This prevents creating Firestore documents for unmigrated legacy users.
            try {
                const docSnap = await getDoc(userRef);
                if (!docSnap.exists()) {
                    console.log(`[FIRESTORE] Skipping save for unmigrated legacy user ${u.phone} to avoid creating document before Firebase Auth.`);
                    return;
                }
            } catch (err) {
                // This is where the permission error happens if not handled.
                // We've added amIAdmin check above, but keeping this try-catch for robustness.
                console.warn(`[FIRESTORE] Failed to check document existence for user ${u.phone} before save:`, err);
                return;
            }

            const userPayload = cleanUndefined({
                fullName: u.fullName,
                email: u.email,
                stores: u.stores || [],
                sites: u.sites || [],
                isAdmin: u.isAdmin || false,
                isBanned: u.isBanned || false,
                joinDate: u.joinDate || '',
                ownedStoreIds: (u.stores || []).map(s => s.id)
            });
            await setDoc(userRef, userPayload, { merge: true }).catch(err => {
                if (err?.code === 'resource-exhausted') {
                    throw new Error('QUOTA_EXCEEDED');
                }
                handleFirestoreError(err, OperationType.WRITE, `users/${u.phone}`);
            });
        });

        await Promise.all(savePromises);
        return { success: true };
    } catch (err: any) {
        if (err.message === 'QUOTA_EXCEEDED') return { success: false, error: 'QUOTA_EXCEEDED' };
        return { success: false, error: err.message };
    }
};

export const clearStoreData = async (storeId: string, targets: string[]): Promise<{ success: boolean, error?: string }> => {
    try {
        const collectionsToClear = targets.map(target => {
            switch (target) {
                case 'orders': return ['orders'];
                case 'products': return ['products'];
                case 'customers': return ['customers'];
                case 'wallet': return ['transactions'];
                case 'activity': return ['activity_logs'];
                case 'coupons': return ['discount_codes'];
                case 'reviews': return ['reviews'];
                case 'abandoned_carts': return ['abandoned_carts'];
                case 'shipping': return ['shipping_integrations'];
                case 'pages': return ['custom_pages'];
                case 'suppliers': return ['suppliers'];
                case 'supply_orders': return ['supply_orders'];
                case 'global_options': return ['global_options'];
                case 'payment_methods': return ['payment_methods'];
                case 'collections': return ['collections'];
                case 'employees': return ['employees'];
                case 'partner_withdrawals': return ['treasury_transactions'];
                case 'partners': return ['partners'];
                default: return [];
            }
        }).flat();

        const clearPromises = collectionsToClear.map(async (colName) => {
            // Try storeId
            let q = query(collection(firebaseDb, colName), where('storeId', '==', storeId));
            let snap = await getDocs(q);
            let deleteDocs = snap.docs.map(doc => deleteDoc(doc.ref));
            
            // Try store_id fallback
            let q_snake = query(collection(firebaseDb, colName), where('store_id', '==', storeId));
            let snap_snake = await getDocs(q_snake);
            let deleteDocs_snake = snap_snake.docs.map(doc => deleteDoc(doc.ref));
            
            await Promise.all([...deleteDocs, ...deleteDocs_snake]);
        });

        await Promise.all(clearPromises);
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
};

export const deleteStoreCompletely = async (storeId: string): Promise<{ success: boolean, error?: string }> => {
    try {
        // Collections to delete
        const collections = [
            'orders', 'products', 'transactions', 'treasury_accounts', 'treasury_transactions', 
            'suppliers', 'supply_orders', 'reviews', 'abandoned_carts', 'activity_logs', 
            'employees', 'discount_codes', 'collections', 'custom_pages', 'payment_methods', 
            'customers', 'global_options', 'shipping_integrations', 'partners'
        ];

        // Delete all documents in those collections for this store
        for (const colName of collections) {
            const q = query(collection(firebaseDb, colName), where('storeId', '==', storeId));
            const snap = await getDocs(q);
            const deleteDocs = snap.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deleteDocs);
        }

        // Delete the store document itself
        const storeRef = doc(firebaseDb, 'stores_data', storeId);
        await deleteDoc(storeRef);

        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
};

export const deleteUserCompletely = async (user: User): Promise<{ success: boolean, error?: string }> => {
    try {
        if (user.stores) {
            for (const store of user.stores) {
                await deleteStoreCompletely(store.id);
            }
        }
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
};

export const migrateAllLegacyDataToRelational = async (users: User[]): Promise<{ success: boolean, summary: string, error?: string }> => {
    let summaryLog: string[] = [];
    try {

        for (const user of users) {
            if (!user.stores) continue;
            for (const store of user.stores) {
                const legacyData = await getLocal(store.id);
                if (legacyData) {
                    const result = await saveStoreData(store, legacyData);
                    if (!result.success) {
                        return { success: false, summary: "Failed at store " + store.name, error: result.error };
                    }
                }
            }
        }
        return { success: true, summary: "Completed" };

    } catch (err: any) {
        return { success: false, summary: "Failed", error: err.message };
    }
};

export const getUserByPhoneFromSupabase = async (phone: string): Promise<User | null> => {
    console.log('[SUPABASE] Fetching legacy user directly by phone:', phone);
    const supabase = getSupabaseClient();
    if (!supabase) {
        console.warn('[SUPABASE] Supabase client is not available in getUserByPhoneFromSupabase');
        return null;
    }
    try {
        const { data, error } = await supabase.from('users').select('*').eq('phone', phone).maybeSingle();
        if (error) {
            console.error('[SUPABASE] Supabase error in getUserByPhoneFromSupabase:', error);
            return null;
        }
        if (!data) {
            console.log(`[SUPABASE] User ${phone} not found in Supabase.`);
            return null;
        }
        const defaultStoreId = data.default_store_id || data.defaultStoreId || (typeof window !== 'undefined' ? localStorage.getItem('defaultStoreId') : undefined) || undefined;
        return {
            fullName: data.full_name || '',
            phone: data.phone,
            email: data.email || '',
            stores: data.stores || [],
            sites: data.sites || [],
            isAdmin: data.is_admin || false,
            isBanned: data.is_banned || false,
            joinDate: data.join_date || '',
            password: data.password || '',
            defaultStoreId,
            autoLaunchDefaultStore: data.auto_launch_default_store !== undefined ? data.auto_launch_default_store : !!defaultStoreId
        };
    } catch (err) {
        console.error('[SUPABASE] Fatal error in getUserByPhoneFromSupabase:', err);
        return null;
    }
};

export const updateUserInSupabase = async (user: User): Promise<{ success: boolean; error?: string }> => {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, error: 'Supabase client not initialized' };
    try {
        const payload = cleanUndefined({
            phone: user.phone,
            email: user.email || null,
            full_name: user.fullName,
            is_admin: user.isAdmin || false,
            is_banned: user.isBanned || false,
            join_date: user.joinDate || new Date().toISOString(),
            stores: user.stores || [],
            sites: user.sites || [],
            password: user.password,
            default_store_id: user.defaultStoreId || null,
            auto_launch_default_store: user.autoLaunchDefaultStore ?? (user.defaultStoreId ? true : false)
        });

        const { error } = await supabase.from('users').upsert(payload, { onConflict: 'phone' });
        
        if (error) {
            console.error('[SUPABASE] Error updating user in Supabase:', error.message, error.details, error.hint);
            if (error.code === '23505') { // Unique violation
                if (error.message.includes('email') || (error.details && error.details.includes('email'))) {
                    return { success: false, error: 'البريد الإلكتروني مستخدم بالفعل في حساب آخر.' };
                }
                return { success: false, error: 'هذه البيانات موجودة مسبقاً في حساب آخر.' };
            }
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (err: any) {
        console.error('[SUPABASE] Fatal error in updateUserInSupabase:', err);
        return { success: false, error: err.message || 'خطأ غير متوقع في قاعدة البيانات.' };
    }
};

let isFsQuotaExceededForUsers = false;
let fsQuotaExceededTimestamp = 0;

export const getUserByPhone = async (phone: string): Promise<User | null> => {
    try {
        const cleanPhone = (phone || '').trim();
        if (!cleanPhone) return null;

        const now = Date.now();
        // 1. Try Firestore if quota is not flagged
        if (!isFsQuotaExceededForUsers || (now - fsQuotaExceededTimestamp > 15 * 60 * 1000)) {
            try {
                const userRef = doc(firebaseDb, 'users', cleanPhone);
                const docSnap = await getDoc(userRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    isFsQuotaExceededForUsers = false;
                    const defaultStoreId = data.defaultStoreId || data.default_store_id || (typeof window !== 'undefined' ? localStorage.getItem('defaultStoreId') : undefined) || undefined;
                    return {
                        fullName: data.fullName || '',
                        phone: docSnap.id,
                        email: data.email || '',
                        password: data.password || '',
                        stores: data.stores || [],
                        sites: data.sites || [],
                        isAdmin: data.isAdmin || false,
                        isBanned: data.isBanned || false,
                        joinDate: data.joinDate || '',
                        defaultStoreId,
                        autoLaunchDefaultStore: data.autoLaunchDefaultStore !== undefined ? data.autoLaunchDefaultStore : !!defaultStoreId
                    };
                }
            } catch (fsErr: any) {
                const msg = String(fsErr?.message || fsErr || '');
                if (msg.includes('quota') || msg.includes('resource-exhausted') || fsErr?.code === 'resource-exhausted') {
                    isFsQuotaExceededForUsers = true;
                    fsQuotaExceededTimestamp = now;
                    // Quiet notice instead of error
                } else {
                    console.warn('[DATABASE-SERVICE] Notice in getUserByPhone:', msg);
                }
            }
        }

        // 2. Try Supabase if not found in Firestore or if Firestore quota exceeded
        const supabase = getSupabaseClient();
        if (supabase) {
            try {
                const { data, error } = await supabase.from('users').select('*').eq('phone', cleanPhone).maybeSingle();
                if (!error && data) {
                    const defaultStoreId = data.default_store_id || data.defaultStoreId || (typeof window !== 'undefined' ? localStorage.getItem('defaultStoreId') : undefined) || undefined;
                    const mappedUser: User = {
                        fullName: data.full_name || '',
                        phone: data.phone,
                        email: data.email || '',
                        stores: data.stores || [],
                        sites: data.sites || [],
                        isAdmin: data.is_admin || false,
                        isBanned: data.is_banned || false,
                        joinDate: data.join_date || '',
                        password: data.password || '',
                        defaultStoreId,
                        autoLaunchDefaultStore: data.auto_launch_default_store !== undefined ? data.auto_launch_default_store : !!defaultStoreId
                    };
                    return mappedUser;
                }
            } catch (sbErr) {
                // Quiet Supabase catch
            }
        }

        // 3. Fallback to local session storage cache
        try {
            const cachedUserStr = localStorage.getItem('user_session_v4') || localStorage.getItem('currentUser');
            if (cachedUserStr) {
                const cached = JSON.parse(cachedUserStr);
                if (cached && (cached.phone === cleanPhone || cached.phone === cleanPhone.replace(/^0+/, ''))) {
                    return cached;
                }
            }
        } catch {}

        return null;
    } catch (err) {
        return null;
    }
};

export const createUserDoc = async (user: User): Promise<boolean> => {
    try {
        console.log('[FIRESTORE] Creating/Updating user record in Firestore for:', user.phone);
        const userRef = doc(firebaseDb, 'users', user.phone);
        const userPayload = {
            fullName: user.fullName,
            email: user.email,
            password: user.password || '',
            stores: user.stores || [],
            sites: user.sites || [],
            isAdmin: user.isAdmin || false,
            isBanned: user.isBanned || false,
            joinDate: user.joinDate || new Date().toISOString(),
            ownedStoreIds: (user.stores || []).map(s => s.id),
            defaultStoreId: user.defaultStoreId || null,
            autoLaunchDefaultStore: user.autoLaunchDefaultStore ?? (user.defaultStoreId ? true : false)
        };
        await setDoc(userRef, userPayload, { merge: true });
        console.log('[FIRESTORE] Successfully created user record in Firestore.');

        const supabase = getSupabaseClient();
        if (supabase) {
            console.log('[SUPABASE] Creating/Updating user record in Supabase for:', user.phone);
            const supabasePayload = {
                full_name: user.fullName,
                phone: user.phone,
                email: user.email,
                stores: user.stores || [],
                sites: user.sites || [],
                is_admin: user.isAdmin || false,
                is_banned: user.isBanned || false,
                join_date: user.joinDate || new Date().toISOString(),
                default_store_id: user.defaultStoreId || null,
                auto_launch_default_store: user.autoLaunchDefaultStore ?? (user.defaultStoreId ? true : false)
            };
            await supabase.from('users').upsert(supabasePayload, { onConflict: 'phone' });
        }
        return true;
    } catch (err) {
        console.error('[DATABASE-SERVICE] Error in createUserDoc:', err);
        return false;
    }
};

export interface PartnerPortalRequest {
    id: string;
    storeId: string;
    partnerId: string;
    partnerName: string;
    type: 'withdrawal' | 'expense' | 'inquiry' | 'subscription_refund' | 'wallet_topup' | 'plan_change_request' | 'custom_plan_quote';
    typeArabic?: string;
    amount: number;
    notes: string;
    date?: string;
    status: 'pending' | 'approved' | 'rejected' | 'quoted';
    createdAt: string;
    isMerchantRequest?: boolean;
    payoutMethod?: string;
    payoutAccount?: string;
    receiptImage?: string;
    transferFee?: number;
    netAmount?: number;
    transferReference?: string;
    approvedBy?: string;
    approvedAt?: string;
    refundMeta?: {
        targetType?: 'self_service' | 'manager';
        planType?: 'self_service' | 'manager';
        planId?: string;
        planName?: string;
        planNameAr?: string;
        billingCycle?: string;
        paidAmount?: number;
        chargeFor14Days?: number;
        charged14DaysAmount?: number;
        chargeForActualDays?: number;
        refundableAmount?: number;
        refundAmount?: number;
        daysElapsed?: number;
        elapsedDays?: number;
        totalCycleDays?: number;
        totalDays?: number;
    };
    planRequestMeta?: any;
}

export const calculateTransferFee = (
    amount: number,
    merchant?: any,
    settings?: any
): number => {
    if (!amount || amount <= 0) return 0;
    const isDaily = merchant?.payoutFrequency === 'daily';
    const feeRate = isDaily
        ? (typeof merchant?.dailyTransferFee === 'number' ? merchant.dailyTransferFee : (settings?.dailyTransferFee ?? 1))
        : (typeof merchant?.weeklyTransferFee === 'number' ? merchant.weeklyTransferFee : (settings?.weeklyTransferFee ?? 25));
    const feeType = isDaily
        ? (merchant?.dailyTransferFeeType || settings?.dailyTransferFeeType || 'percentage')
        : (merchant?.weeklyTransferFeeType || settings?.weeklyTransferFeeType || 'fixed');

    if (feeRate > 0) {
        if (feeType === 'percentage') {
            return Math.round((amount * (feeRate / 100)) * 100) / 100;
        } else {
            return Math.min(amount, Number(feeRate) || 0);
        }
    }
    return 0;
};

export const submitPartnerRequest = async (
    storeIdOrObj: string | (Partial<PartnerPortalRequest> & { storeId: string }),
    maybeReq?: Partial<PartnerPortalRequest>
): Promise<{ success: boolean; error?: string }> => {
    try {
        const isObjFirst = typeof storeIdOrObj === 'object' && storeIdOrObj !== null;
        const storeId = isObjFirst ? String(storeIdOrObj.storeId || '') : String(storeIdOrObj || '');
        const rawReq: Partial<PartnerPortalRequest> = isObjFirst ? storeIdOrObj : (maybeReq || {});
        const nowIso = new Date().toISOString();
        const reqId = rawReq.id || `REQ-P-${generateUniqueOrderId('p')}`;

        const fullRequest: PartnerPortalRequest = {
            id: reqId,
            storeId,
            partnerId: rawReq.partnerId || '',
            partnerName: rawReq.partnerName || '',
            type: (rawReq.type as any) || 'withdrawal',
            typeArabic: rawReq.typeArabic || 'طلب شريك',
            amount: Number(rawReq.amount || 0),
            transferFee: typeof rawReq.transferFee === 'number' ? rawReq.transferFee : undefined,
            netAmount: typeof rawReq.netAmount === 'number' ? rawReq.netAmount : Number(rawReq.amount || 0),
            notes: rawReq.notes || '',
            date: rawReq.date || nowIso,
            status: rawReq.status || 'pending',
            createdAt: rawReq.createdAt || nowIso,
            isMerchantRequest: rawReq.isMerchantRequest ?? false,
            ...(rawReq.payoutMethod ? { payoutMethod: rawReq.payoutMethod } : {}),
            ...(rawReq.payoutAccount ? { payoutAccount: rawReq.payoutAccount } : {}),
            ...(rawReq.transferReference ? { transferReference: rawReq.transferReference } : {}),
            ...(rawReq.refundMeta ? { refundMeta: rawReq.refundMeta } : {}),
            ...(rawReq.planRequestMeta ? { planRequestMeta: rawReq.planRequestMeta } : {})
        };

        // 1. Save to local storage for instant offline resilience
        try {
            const localKey = `partner_requests_${storeId}`;
            const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
            const filtered = existing.filter((r: any) => r.id !== reqId);
            localStorage.setItem(localKey, JSON.stringify([fullRequest, ...filtered]));
        } catch (_) {}

        // 2. Save directly to Firestore collection 'partner_requests'
        if (firebaseDb) {
            const reqRef = doc(firebaseDb, 'partner_requests', reqId);
            await setDoc(reqRef, cleanUndefined(fullRequest));
            console.log('[PARTNER-REQUEST] Successfully saved partner request to Firestore:', reqId);
        }

        // 3. Save to Supabase if active
        const supabase = getSupabaseClient();
        if (supabase) {
            try {
                await supabase.from('partner_requests').upsert({
                    ...cleanUndefined(fullRequest),
                    store_id: storeId,
                    partner_id: fullRequest.partnerId,
                    is_merchant_request: fullRequest.isMerchantRequest
                });
            } catch (err) {
                console.warn('[PARTNER-REQUEST] Supabase upsert failed:', err);
            }
        }

        return { success: true };
    } catch (err: any) {
        console.error('[PARTNER-REQUEST] Error submitting partner request:', err);
        return { success: false, error: err.message };
    }
};

export const getPartnerRequests = async (storeId: string): Promise<PartnerPortalRequest[]> => {
    const localKey = `partner_requests_${storeId}`;
    const merchantKey = `merchant_requests_${storeId}`;
    const merged = new Map<string, PartnerPortalRequest>();
    
    // 1. Initialise with cached requests from localStorage for instant UI
    try {
        const local = JSON.parse(localStorage.getItem(localKey) || '[]');
        if (Array.isArray(local)) {
            local.forEach(r => { if (r && r.id) merged.set(String(r.id), r); });
        }
    } catch (_) {}

    try {
        const merchantCached = JSON.parse(localStorage.getItem(merchantKey) || '[]');
        if (Array.isArray(merchantCached)) {
            merchantCached.forEach(r => {
                if (r && r.id && !merged.has(String(r.id))) {
                    merged.set(String(r.id), toMerchantRequestView(r, 'merchant_requests'));
                }
            });
        }
    } catch (_) {}

    // 2. PRIMARY: Supabase
    const supabase = getSupabaseClient();
    if (supabase) {
        try {
            // Get from partner_requests
            const { data: pData, error: pError } = await supabase
                .from('partner_requests')
                .select('*')
                .eq('store_id', storeId);
            
            if (!pError && Array.isArray(pData)) {
                pData.forEach((r: any) => {
                    if (r.id) {
                        merged.set(String(r.id), {
                            ...r,
                            partnerId: r.partner_id ?? r.partnerId,
                            partnerName: r.partner_name ?? r.partnerName,
                            createdAt: r.created_at ?? r.createdAt,
                            updatedAt: r.updated_at ?? r.updatedAt,
                            legacySource: 'partner_requests'
                        });
                    }
                });
            }

            // Get from merchant_requests
            const { data: mData, error: mError } = await supabase
                .from('merchant_requests')
                .select('*')
                .eq('store_id', storeId);
            
            if (!mError && Array.isArray(mData)) {
                mData.forEach((r: any) => {
                    if (r.id) {
                        merged.set(String(r.id), toMerchantRequestView(r, 'merchant_requests'));
                    }
                });
            }
        } catch (err) {
            console.warn('[PARTNER-REQUEST] Supabase read failed:', err);
        }
    }

    // 3. SECONDARY: Firestore Fallback/Merge
    if (firebaseDb && !isFirestoreQuotaExhausted) {
        try {
            // Fetch from partner_requests collection
            const pSnap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'partner_requests'), where('storeId', '==', storeId))), 5000);
            pSnap.forEach(docSnap => {
                const r = { id: docSnap.id, ...docSnap.data() } as any;
                if (r && r.id && !merged.has(String(r.id))) {
                    merged.set(String(r.id), {
                        ...r,
                        partnerId: r.partner_id ?? r.partnerId,
                        partnerName: r.partner_name ?? r.partnerName,
                        createdAt: r.created_at ?? r.createdAt,
                        updatedAt: r.updated_at ?? r.updatedAt,
                        legacySource: 'partner_requests'
                    } as PartnerPortalRequest);
                }
            });

            // Fetch from merchant_requests collection (partners might also be merchants)
            const mSnap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'merchant_requests'), where('storeId', '==', storeId))), 5000);
            mSnap.forEach(docSnap => {
                const r = { id: docSnap.id, ...docSnap.data() } as any;
                if (r && r.id && !merged.has(String(r.id))) {
                    merged.set(String(r.id), toMerchantRequestView(r, 'merchant_requests'));
                }
            });
        } catch (fsErr) {
            const msg = String((fsErr as any)?.message || fsErr);
            if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
            console.warn('[PARTNER-REQUEST] Firestore read failed:', fsErr);
        }
    }

    const result = Array.from(merged.values()).sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt || 0).getTime();
        const dateB = new Date(b.date || b.createdAt || 0).getTime();
        return dateB - dateA;
    });

    try {
        localStorage.setItem(localKey, JSON.stringify(result));
    } catch (_) {}

    return result;
};

export const updatePartnerRequestStatus = async (
    requestId: string,
    storeId: string,
    status: 'approved' | 'rejected',
    meta?: { receiptImage?: string; transferReference?: string; approvedBy?: string; approvedAt?: string }
): Promise<boolean> => {
    try {
        const extraFields = cleanUndefined({
            ...(meta?.receiptImage ? { receiptImage: meta.receiptImage } : {}),
            ...(meta?.transferReference ? { transferReference: meta.transferReference } : {}),
            ...(meta?.approvedBy ? { approvedBy: meta.approvedBy } : {}),
            ...(meta?.approvedAt ? { approvedAt: meta.approvedAt } : {})
        });

        let updated = false;
        const nowIso = new Date().toISOString();

        const supabase = getSupabaseClient();
        if (supabase) {
            try {
                // Try updating in partner_requests
                const { data: pData, error: pErr } = await supabase
                    .from('partner_requests')
                    .update({ status, updated_at: nowIso, ...extraFields })
                    .eq('id', requestId)
                    .eq('store_id', storeId)
                    .select();
                
                if (!pErr && pData && pData.length > 0) {
                    updated = true;
                } else {
                    // Try merchant_requests
                    const { data: mData, error: mErr } = await supabase
                        .from('merchant_requests')
                        .update({ status, updated_at: nowIso, ...extraFields })
                        .eq('id', requestId)
                        .eq('store_id', storeId)
                        .select();
                    
                    if (!mErr && mData && mData.length > 0) {
                        updated = true;
                    }
                }
            } catch (err) {
                console.warn('[PARTNER-REQUEST] Supabase status update failed:', err);
            }
        }

        // 3. Update Firestore
        if (firebaseDb) {
            try {
                // Update in both potential collections to ensure consistency
                const collections = ['partner_requests', 'merchant_requests'];
                for (const collName of collections) {
                    const docRef = doc(firebaseDb, collName, requestId);
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        await updateDoc(docRef, { 
                            status, 
                            updatedAt: nowIso, 
                            updated_at: nowIso,
                            ...extraFields 
                        });
                        updated = true;
                    }
                }
            } catch (fsErr) {
                console.warn('[PARTNER-REQUEST] Firestore status update failed:', fsErr);
            }
        }

        return updated;
    } catch (err) {
        console.error('[PARTNER-REQUEST] Error updating partner request status:', err);
        return false;
    }
};

export const deletePartnerRequestDoc = async (requestId: string, storeId: string): Promise<boolean> => {
    try {
        if (firebaseDb) {
            await deleteDoc(doc(firebaseDb, 'partner_requests', requestId)).catch(() => {});
            await deleteDoc(doc(firebaseDb, 'merchant_requests', requestId)).catch(() => {});
        }

        try {
            const localKey = `partner_requests_${storeId}`;
            const merchantKey = `merchant_requests_${storeId}`;
            [localKey, merchantKey].forEach(key => {
                const existing = JSON.parse(localStorage.getItem(key) || '[]');
                const updated = existing.filter((r: any) => r.id !== requestId);
                localStorage.setItem(key, JSON.stringify(updated));
            });
        } catch (_) {}

        return true;
    } catch (err) {
        console.error('[PARTNER-REQUEST] Error deleting partner request:', err);
        return false;
    }
};

export interface MerchantPortalRequest extends Omit<PartnerPortalRequest, 'partnerId' | 'partnerName' | 'isMerchantRequest'> {
    merchantId: string;
    merchantName: string;
    legacySource?: 'merchant_requests' | 'partner_requests';
}

const toMerchantRequestView = (raw: any, legacySource: 'merchant_requests' | 'partner_requests'): PartnerPortalRequest => ({
    ...raw,
    partnerId: String(raw.merchantId ?? raw.merchant_id ?? raw.partnerId ?? ''),
    partnerName: String(raw.merchantName ?? raw.merchant_name ?? raw.partnerName ?? ''),
    typeArabic: raw.typeArabic ?? raw.type_arabic,
    payoutMethod: raw.payoutMethod ?? raw.payout_method,
    payoutAccount: raw.payoutAccount ?? raw.payout_account,
    transferReference: raw.transferReference ?? raw.transfer_reference,
    createdAt: raw.createdAt ?? raw.created_at,
    isMerchantRequest: true,
    legacySource
} as PartnerPortalRequest);

const isLegacyMerchantRequest = (r: any): boolean => Boolean(r && (
    r.isMerchantRequest === true ||
    r.is_merchant_request === true ||
    String(r.id || '').startsWith('REQ-M-') ||
    String(r.id || '').startsWith('preq_') ||
    String(r.typeArabic || '').includes('الموكل') ||
    String(r.partnerId || '').startsWith('m_') ||
    String(r.partnerId || '').startsWith('sup_')
));

export const submitMerchantRequest = async (
    storeIdOrObj: string | (Partial<PartnerPortalRequest> & { storeId: string }),
    maybeReq?: Partial<PartnerPortalRequest>
): Promise<{ success: boolean; error?: string }> => {
    try {
        const isObjFirst = typeof storeIdOrObj === 'object' && storeIdOrObj !== null;
        const storeId = isObjFirst ? String(storeIdOrObj.storeId || '') : String(storeIdOrObj || '');
        const rawReq: Partial<PartnerPortalRequest> = isObjFirst ? storeIdOrObj : (maybeReq || {});
        if (!storeId) return { success: false, error: 'Missing storeId' };
        
        const nowIso = new Date().toISOString();
        const requestId = rawReq.id || `REQ-M-${generateUniqueOrderId('m')}`;
        
        const request: MerchantPortalRequest = {
            id: requestId,
            storeId,
            merchantId: rawReq.partnerId || '',
            merchantName: rawReq.partnerName || '',
            type: (rawReq.type as any) || 'withdrawal',
            typeArabic: rawReq.typeArabic || 'طلب موكل',
            amount: Number(rawReq.amount || 0),
            transferFee: typeof rawReq.transferFee === 'number' ? rawReq.transferFee : undefined,
            netAmount: typeof rawReq.netAmount === 'number' ? rawReq.netAmount : Number(rawReq.amount || 0),
            notes: rawReq.notes || '',
            date: rawReq.date || nowIso,
            status: rawReq.status || 'pending',
            createdAt: rawReq.createdAt || nowIso,
            ...(rawReq.payoutMethod ? { payoutMethod: rawReq.payoutMethod } : {}),
            ...(rawReq.payoutAccount ? { payoutAccount: rawReq.payoutAccount } : {}),
            ...(rawReq.transferReference ? { transferReference: rawReq.transferReference } : {}),
            ...(rawReq.refundMeta ? { refundMeta: rawReq.refundMeta } : {}),
            ...(rawReq.planRequestMeta ? { planRequestMeta: rawReq.planRequestMeta } : {})
        };

        // 1. Update LocalStorage for instant feedback
        try {
            const key = `merchant_requests_${storeId}`;
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            localStorage.setItem(key, JSON.stringify([request, ...existing.filter((r: any) => r.id !== request.id)]));
        } catch (_) {}

        // 2. PRIMARY: Supabase
        const supabase = getSupabaseClient();
        if (!supabase) {
            return { success: false, error: 'Supabase client not initialized' };
        }

        const supabasePayload = {
            id: request.id,
            store_id: storeId,
            merchant_id: request.merchantId,
            merchant_name: request.merchantName,
            type: request.type,
            type_arabic: request.typeArabic,
            amount: request.amount,
            notes: request.notes,
            date: request.date,
            status: request.status,
            payout_method: request.payoutMethod,
            payout_account: request.payoutAccount,
            transfer_reference: request.transferReference,
            created_at: request.createdAt,
            updated_at: nowIso
        };

        const { error: upsertError } = await supabase.from('merchant_requests').upsert(supabasePayload);
        if (upsertError) throw upsertError;

        // 3. Save to Firestore for real-time notifications
        if (firebaseDb) {
            try {
                const fsRequest = {
                    ...request,
                    partnerId: request.merchantId,
                    partnerName: request.merchantName,
                    isMerchantRequest: true
                };
                await setDoc(doc(firebaseDb, 'merchant_requests', request.id), cleanUndefined(fsRequest));
                console.log('[MERCHANT-REQUEST] Successfully saved merchant request to Firestore:', request.id);
            } catch (fsErr) {
                console.warn('[MERCHANT-REQUEST] Firestore save failed:', fsErr);
            }
        }

        // 3. Update Balance in partners/suppliers table and settings JSON (Simulating atomicity)
        // This is a temporary measure until an RPC is implemented.
        try {
            const { data: storeRow } = await supabase.from('stores_data').select('settings').eq('id', storeId).maybeSingle();
            if (storeRow?.settings) {
                const settings = storeRow.settings;
                const partners = Array.isArray(settings.partners) ? [...settings.partners] : [];
                const suppliers = Array.isArray(settings.suppliers) ? [...settings.suppliers] : [];
                
                let found = false;
                // Update in partners
                const nextPartners = partners.map(p => {
                    if (String(p.id) === String(request.merchantId)) {
                        found = true;
                        // Note: We don't deduct balance here yet because the request is 'pending'
                        // but the UI calculates available balance by subtracting pending requests.
                        // We just need to make sure the request is PERSISTED so it doesn't disappear.
                        return p;
                    }
                    return p;
                });

                const nextSuppliers = suppliers.map(s => {
                    if (String(s.id) === String(request.merchantId)) {
                        found = true;
                        return s;
                    }
                    return s;
                });

                if (found) {
                    await supabase.from('stores_data').update({ 
                        settings: { ...settings, partners: nextPartners, suppliers: nextSuppliers },
                        updated_at: nowIso
                    }).eq('id', storeId);
                }
            }
        } catch (syncErr) {
            console.warn('[MERCHANT-REQUEST] Failed to sync balance settings:', syncErr);
        }

        return { success: true };
    } catch (err: any) {
        console.error('[MERCHANT-REQUEST] Error submitting merchant request:', err);
        return { success: false, error: err?.message || 'Unable to submit request' };
    }
};

export const getMerchantRequests = async (storeId: string): Promise<PartnerPortalRequest[]> => {
    const key = `merchant_requests_${storeId}`;
    const legacyKey = `partner_requests_${storeId}`;
    const merged = new Map<string, PartnerPortalRequest>();

    // 1. Initialise with cached requests from localStorage for instant UI
    try {
        const cached = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(cached)) {
            cached.forEach(r => {
                if (r && r.id) merged.set(String(r.id), toMerchantRequestView(r, 'merchant_requests'));
            });
        }
    } catch (_) {}

    try {
        const cachedLeg = JSON.parse(localStorage.getItem(legacyKey) || '[]');
        if (Array.isArray(cachedLeg)) {
            cachedLeg.filter(isLegacyMerchantRequest).forEach(r => {
                if (r && r.id && !merged.has(String(r.id))) {
                    merged.set(String(r.id), toMerchantRequestView(r, 'partner_requests'));
                }
            });
        }
    } catch (_) {}

    // 2. PRIMARY: Supabase
    const supabase = getSupabaseClient();
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('merchant_requests')
                .select('*')
                .eq('store_id', storeId);
            if (!error && Array.isArray(data)) {
                data.forEach((r: any) => {
                    if (r && r.id) merged.set(String(r.id), toMerchantRequestView(r, 'merchant_requests'));
                });
            }
        } catch (err) {
            console.warn('[MERCHANT-REQUEST] Supabase read failed:', err);
        }

        try {
            const { data: pData, error: pError } = await supabase
                .from('partner_requests')
                .select('*')
                .eq('store_id', storeId);
            if (!pError && Array.isArray(pData)) {
                pData.filter(isLegacyMerchantRequest).forEach((r: any) => {
                    if (r && r.id) {
                        merged.set(String(r.id), toMerchantRequestView(r, 'partner_requests'));
                    }
                });
            }
        } catch (err) {
            console.warn('[MERCHANT-REQUEST] Supabase partner_requests read failed:', err);
        }
    }

    // 3. SECONDARY: Firestore Fallback/Merge
    if (firebaseDb && !isFirestoreQuotaExhausted) {
        try {
            // Fetch from merchant_requests collection
            const mSnap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'merchant_requests'), where('storeId', '==', storeId))), 5000);
            mSnap.forEach(docSnap => {
                const r = { id: docSnap.id, ...docSnap.data() };
                if (r && r.id && !merged.has(String(r.id))) {
                    merged.set(String(r.id), toMerchantRequestView(r, 'merchant_requests'));
                }
            });

            // Fetch from partner_requests collection (for legacy)
            const pSnap = await WITH_TIMEOUT(getDocs(query(collection(firebaseDb, 'partner_requests'), where('storeId', '==', storeId))), 5000);
            pSnap.forEach(docSnap => {
                const r = { id: docSnap.id, ...docSnap.data() };
                if (r && r.id && !merged.has(String(r.id)) && isLegacyMerchantRequest(r)) {
                    merged.set(String(r.id), toMerchantRequestView(r, 'partner_requests'));
                }
            });
        } catch (fsErr) {
            const msg = String((fsErr as any)?.message || fsErr);
            if (msg.includes('quota') || msg.includes('resource-exhausted')) markFirestoreQuotaExhausted();
            console.warn('[MERCHANT-REQUEST] Firestore read failed:', fsErr);
        }
    }

    const result = Array.from(merged.values()).sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt || 0).getTime();
        const dateB = new Date(b.date || b.createdAt || 0).getTime();
        return dateB - dateA;
    });

    // Update cache
    try {
        localStorage.setItem(key, JSON.stringify(result));
    } catch (_) {}

    return result;
};

export const updateMerchantRequestStatus = async (
    requestId: string,
    storeId: string,
    status: 'approved' | 'rejected',
    meta?: { receiptImage?: string; transferReference?: string; approvedBy?: string; approvedAt?: string }
): Promise<boolean> => {
    // Reuse the unified partner update logic which now handles both tables
    return updatePartnerRequestStatus(requestId, storeId, status, meta);
};

export const deleteMerchantRequestDoc = async (requestId: string, storeId: string): Promise<boolean> => {
    try {
        let found = false;
        const supabase = getSupabaseClient();
        if (supabase) {
            try {
                const { error: err1 } = await supabase.from('merchant_requests').delete().eq('id', requestId).eq('store_id', storeId);
                const { error: err2 } = await supabase.from('partner_requests').delete().eq('id', requestId).eq('store_id', storeId);
                if (!err1 || !err2) found = true;
            } catch (err) {
                console.warn('[MERCHANT-REQUEST] Supabase delete failed:', err);
            }
        }
        if (firebaseDb) {
            try {
                await deleteDoc(doc(firebaseDb, 'merchant_requests', requestId)).catch(() => {});
                await deleteDoc(doc(firebaseDb, 'partner_requests', requestId)).catch(() => {});
            } catch (_) {}
        }

        for (const key of [`merchant_requests_${storeId}`, `partner_requests_${storeId}`]) {
            try {
                const rows = JSON.parse(localStorage.getItem(key) || '[]');
                const before = rows.length;
                const filtered = rows.filter((r: any) => r.id !== requestId);
                if (filtered.length !== before) {
                    found = true;
                    localStorage.setItem(key, JSON.stringify(filtered));
                }
            } catch (_) {}
        }
        return found;
    } catch (err) {
        console.error('[MERCHANT-REQUEST] Error deleting merchant request:', err);
        return false;
    }
};

export const updatePartnerSettings = async (storeId: string, partners: any[], suppliers?: any[]): Promise<{ success: boolean; error?: string }> => {
    try {
        if (!storeId) return { success: false, error: 'Missing storeId' };

        // 1. Update local IndexedDB cache immediately
        try {
            const localData = await getLocal(storeId);
            if (localData && localData.settings) {
                const nextLocalSettings = {
                    ...localData.settings,
                    partners: partners || localData.settings.partners || [],
                    ...(suppliers ? { suppliers } : {})
                };
                await saveLocal(storeId, {
                    ...localData,
                    settings: nextLocalSettings
                });
            }
        } catch (_) {}

        // 2. Update Firestore stores_data and subcollections
        if (firebaseDb) {
            const storeRef = doc(firebaseDb, 'stores_data', storeId);
            const snap = await getDoc(storeRef);
            const existingSettings = snap.exists() ? (snap.data()?.settings || {}) : {};
            const updatedSettingsPayload: any = {
                ...existingSettings,
                partners: cleanUndefined(partners)
            };
            if (suppliers) {
                updatedSettingsPayload.suppliers = cleanUndefined(suppliers);
            }
            await setDoc(storeRef, {
                settings: updatedSettingsPayload,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            const cleanSupps = suppliers ? sanitizeSuppliersList(suppliers) : undefined;

            if (cleanSupps) {
                try {
                    const snap = await getDocs(query(collection(firebaseDb, 'suppliers'), where('storeId', '==', storeId)));
                    const keepIds = new Set(cleanSupps.map((s: any) => String(s?.id || '')));
                    const deleteSupplierDocs = snap.docs
                        .filter(d => {
                            const rawId = d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id;
                            return (!keepIds.has(rawId) && !keepIds.has(d.id)) || isDummyMockSupplier(d.data());
                        })
                        .map(async (d) => {
                            const rawId = d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id;
                            recordExplicitDeletion(`${storeId}_suppliers_${d.id}`);
                            recordExplicitDeletion(`${storeId}_suppliers_${rawId}`);
                            await deleteDoc(d.ref).catch(() => {});
                        });
                    await Promise.all(deleteSupplierDocs);
                } catch (_) {}
            }

            if (partners) {
                try {
                    const snap = await getDocs(query(collection(firebaseDb, 'partners'), where('storeId', '==', storeId)));
                    const keepIds = new Set(partners.map((p: any) => String(p?.id || '')));
                    const deletePartnerDocs = snap.docs
                        .filter(d => {
                            const rawId = d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id;
                            return !keepIds.has(rawId) && !keepIds.has(d.id);
                        })
                        .map(async (d) => {
                            const rawId = d.id.startsWith(storeId + '_') ? d.id.substring(storeId.length + 1) : d.id;
                            recordExplicitDeletion(`${storeId}_partners_${d.id}`);
                            recordExplicitDeletion(`${storeId}_partners_${rawId}`);
                            await deleteDoc(d.ref).catch(() => {});
                        });
                    await Promise.all(deletePartnerDocs);
                } catch (_) {}
            }

            const partnerWrites = (partners || []).map(async (p) => {
                if (!p || !p.id) return;
                const docId = String(p.id).startsWith(storeId) ? String(p.id) : `${storeId}_${p.id}`;
                const pRef = doc(firebaseDb, 'partners', docId);
                await setDoc(pRef, cleanUndefined({
                    ...p,
                    storeId,
                    store_id: storeId,
                    updatedAt: new Date().toISOString()
                }), { merge: true }).catch(() => {});
            });

            const supplierWrites = (cleanSupps || []).map(async (s) => {
                if (!s || !s.id) return;
                const docId = String(s.id).startsWith(storeId) ? String(s.id) : `${storeId}_${s.id}`;
                const sRef = doc(firebaseDb, 'suppliers', docId);
                await setDoc(sRef, cleanUndefined({
                    ...s,
                    storeId,
                    store_id: storeId,
                    updatedAt: new Date().toISOString()
                }), { merge: true }).catch(() => {});
            });

            await Promise.all([...partnerWrites, ...supplierWrites]);
        }

        // 3. Update Supabase stores_data settings JSON
        const supabase = getSupabaseClient();
        if (supabase) {
            try {
                const { data: row } = await supabase.from('stores_data').select('settings').eq('id', storeId).maybeSingle();
                const currentSettings = row?.settings || {};
                const nextSettings: any = {
                    ...currentSettings,
                    partners: cleanUndefined(partners)
                };
                if (suppliers) {
                    nextSettings.suppliers = cleanUndefined(suppliers);
                }
                await supabase.from('stores_data').upsert({
                    id: storeId,
                    settings: nextSettings
                }, { onConflict: 'id' });
            } catch (_) {}
        }

        return { success: true };
    } catch (err: any) {
        console.warn('[DATABASE-SERVICE] Could not update partner settings directly:', err);
        return { success: false, error: err?.message || 'Error' };
    }
};

export const resetMerchantAccountData = async (
    storeId: string,
    merchantId: string,
    merchantName: string
): Promise<{ success: boolean; remainingOrders: Order[]; updatedSuppliers: any[]; updatedPartners: any[] }> => {
    const cleanMId = String(merchantId || '').trim().toLowerCase();
    const cleanMName = String(merchantName || '').trim().toLowerCase();

    const isMerchantOrder = (o: any): boolean => {
        if (!o) return false;
        const det = (o.details && typeof o.details === 'object') ? o.details : {};
        const oId = String(o.merchantId || o.merchant_id || det.merchantId || '').trim().toLowerCase();
        const oName = String(o.merchantName || o.merchant_name || det.merchantName || '').trim().toLowerCase();
        return Boolean(cleanMId && oId === cleanMId);
    };

    const isMerchantEntity = (e: any): boolean => {
        if (!e) return false;
        const eId = String(e.id || '').trim().toLowerCase();
        const eName = String(e.name || '').trim().toLowerCase();
        return Boolean(cleanMId && eId === cleanMId);
    };

    let remainingOrders: Order[] = [];
    let updatedSuppliers: any[] = [];
    let updatedPartners: any[] = [];

    try {
        // 1. Clean IndexedDB & LocalStorage
        const localData = await getLocal(storeId);
        if (localData) {
            const oldOrders: Order[] = Array.isArray(localData.orders) ? localData.orders : [];
            // Preserve historical orders and financial ledgers; reset is not a deletion/migration mechanism.
            remainingOrders = oldOrders;

            updatedSuppliers = localData.settings?.suppliers || [];
            // Partner records and their ledger are a separate domain; preserve them verbatim.
            updatedPartners = localData.settings?.partners || [];
            const updatedPartnerTxs = localData.settings?.partnerTransactions || [];

            const nextLocalData = {
                ...localData,
                orders: remainingOrders,
                settings: {
                    ...localData.settings,
                    suppliers: updatedSuppliers,
                    partners: updatedPartners,
                    partnerTransactions: updatedPartnerTxs
                }
            };
            await saveLocal(storeId, nextLocalData);
        }

        // 2. Clean local partner_requests cache
        try {
            const localKey = `partner_requests_${storeId}`;
            const existingReqs = JSON.parse(localStorage.getItem(localKey) || '[]');
            const filteredReqs = existingReqs.filter(
                (r: any) => !isMerchantEntity({ id: r.merchantId || r.partnerId, name: r.merchantName || r.partnerName }) && !r.isMerchantRequest
            );
            localStorage.setItem(localKey, JSON.stringify(filteredReqs));
            const merchantLocalKey = `merchant_requests_${storeId}`;
            const merchantReqs = JSON.parse(localStorage.getItem(merchantLocalKey) || '[]');
            localStorage.setItem(merchantLocalKey, JSON.stringify(merchantReqs.filter((r: any) => !isMerchantEntity({ id: r.merchantId, name: r.merchantName }))));
        } catch (_) {}

        // 3. Clean Firestore partner_requests & orders & settings
        if (firebaseDb) {
            try {
                const qReq = query(collection(firebaseDb, 'partner_requests'), where('storeId', '==', storeId));
                const reqSnap = await getDocs(qReq);
                for (const d of reqSnap.docs) {
                    const rData = d.data();
                    if (isMerchantEntity({ id: rData.partnerId, name: rData.partnerName }) || rData.isMerchantRequest) {
                        await deleteDoc(d.ref).catch(() => {});
                    }
                }
            } catch (_) {}

            const qMerchantReq = query(collection(firebaseDb, 'merchant_requests'), where('storeId', '==', storeId));
            const merchantReqSnap = await getDocs(qMerchantReq);
            for (const d of merchantReqSnap.docs) {
                const rData = d.data();
                if (isMerchantEntity({ id: rData.merchantId, name: rData.merchantName })) {
                    await deleteDoc(d.ref).catch(() => {});
                }
            }
            if (updatedPartners.length > 0 || updatedSuppliers.length > 0) {
                await updatePartnerSettings(storeId, updatedPartners, updatedSuppliers).catch(() => {});
            }
        }

        // 4. Preserve Supabase orders and financial ledgers for auditability.
        const supabase = getSupabaseClient();
        void supabase;

        return { success: true, remainingOrders, updatedSuppliers, updatedPartners };
    } catch (e) {
        console.error('[resetMerchantAccountData] Error:', e);
        return { success: false, remainingOrders, updatedSuppliers, updatedPartners };
    }
};

// ============================================================================
// RESOURCE SAVING & REALTIME OPTIMIZATION UTILITIES
// ============================================================================

/**
 * 1. Strict Row-Level Filtered Realtime Subscription Manager
 * Opens a Supabase/Firestore real-time subscription strictly scoped to the target store ID.
 * Enforces row-level filtering at the subscription level so the browser only receives
 * signals for the active store and ignores data from other stores/tenants.
 */
export interface RealtimeSubscriptionOptions {
    tables?: string[];
    onUpdate?: (payload: { table: string; eventType: string; newRecord?: any }) => void;
}

export const subscribeToStoreRealtimeOptimized = (
    storeId: string,
    options: RealtimeSubscriptionOptions = {}
): (() => void) => {
    if (!storeId) return () => {};

    const cleanStoreId = storeId.trim();
    const tablesToListen = options.tables || ['orders', 'merchant_requests', 'partner_requests', 'products', 'transactions', 'stores_data'];
    const unsubs: Array<() => void> = [];

    // A. Supabase Realtime Channel with Strict Row-Level Filter (.eq('store_id', cleanStoreId))
    const supabase = getSupabaseClient();
    if (supabase) {
        try {
            const channelName = `realtime_store_${cleanStoreId}_${Date.now().toString(36)}`;
            const channel = supabase.channel(channelName);

            tablesToListen.forEach(table => {
                // For stores_data, the primary key is 'id' which IS the storeId
                const filterField = (table === 'stores_data' || table === 'users') ? 'id' : 'store_id';
                
                channel.on(
                    'postgres_changes' as any,
                    {
                        event: '*',
                        schema: 'public',
                        table: table,
                        filter: `${filterField}=eq.${cleanStoreId}`
                    },
                    (payload: any) => {
                        if (options.onUpdate) {
                            options.onUpdate({
                                table,
                                eventType: payload.eventType || 'UPDATE',
                                newRecord: payload.new || payload.record
                            });
                        }
                    }
                );
            });

            channel.subscribe((status: string) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`[REALTIME-OPTIMIZED] Supabase Subscribed to store '${cleanStoreId}' for tables: ${tablesToListen.join(', ')}`);
                }
            });

            unsubs.push(() => {
                try {
                    supabase.removeChannel(channel);
                } catch (_) {}
            });
        } catch (err) {
            console.warn('[REALTIME-OPTIMIZED] Error creating Supabase channel:', err);
        }
    }

    // Teardown / Clean Cleanup
    return () => {
        unsubs.forEach(fn => {
            try { fn(); } catch (_) {}
        });
        console.log(`[REALTIME-OPTIMIZED] Unsubscribed all listeners for store '${cleanStoreId}'.`);
    };
};

/**
 * 2. Throttling & Debouncing Data Refresh Manager
 * Prevents rapid cascading re-fetches when multiple real-time signals arrive in quick succession.
 * Ensures data refreshes occur at most once every `minIntervalMs` (default 3000ms).
 */
const refreshTimersMap = new Map<string, { timer: ReturnType<typeof setTimeout> | null; lastExecTime: number }>();

export const throttledRefreshStoreData = (
    storeId: string,
    onDataUpdated: (data: StoreData) => void,
    minIntervalMs: number = 3000
) => {
    if (!storeId) return;

    const state = refreshTimersMap.get(storeId) || { timer: null, lastExecTime: 0 };
    const now = Date.now();
    const elapsed = now - state.lastExecTime;

    const executeFetch = async () => {
        state.lastExecTime = Date.now();
        state.timer = null;
        refreshTimersMap.set(storeId, state);

        try {
            const fresh = await getStoreData(storeId, true);
            if (fresh) {
                onDataUpdated(fresh);
            }
        } catch (err) {
            console.warn(`[THROTTLED-REFRESH] Error refreshing store ${storeId}:`, err);
        }
    };

    if (elapsed >= minIntervalMs) {
        if (state.timer) {
            clearTimeout(state.timer);
            state.timer = null;
        }
        executeFetch();
    } else {
        if (!state.timer) {
            const delay = minIntervalMs - elapsed;
            state.timer = setTimeout(() => {
                executeFetch();
            }, delay);
            refreshTimersMap.set(storeId, state);
        }
    }
};

/**
 * 3. Incremental Sync & Partial Data Fetching
 * Fetches only records updated or created since `lastSyncIsoTimestamp`
 * instead of re-downloading the full store dataset on every change.
 */
export const syncIncrementalStoreData = async (
    storeId: string,
    lastSyncIsoTimestamp: string
): Promise<{
    updatedOrders: Order[];
    updatedPartnerRequests: PartnerPortalRequest[];
    timestamp: string;
}> => {
    const cleanStoreId = storeId.trim();
    const currentIso = new Date().toISOString();
    let updatedOrders: Order[] = [];
    let updatedPartnerRequests: PartnerPortalRequest[] = [];

    const supabase = getSupabaseClient();
    if (supabase) {
        try {
            const [ordersRes, reqsRes] = await Promise.all([
                supabase
                    .from('orders')
                    .select('*')
                    .eq('store_id', cleanStoreId)
                    .gt('updated_at', lastSyncIsoTimestamp),
                supabase
                    .from('partner_requests')
                    .select('*')
                    .eq('storeId', cleanStoreId)
                    .gt('created_at', lastSyncIsoTimestamp)
            ]);

            if (ordersRes.data) {
                updatedOrders = ordersRes.data as Order[];
            }
            if (reqsRes.data) {
                updatedPartnerRequests = reqsRes.data as PartnerPortalRequest[];
            }

            return { updatedOrders, updatedPartnerRequests, timestamp: currentIso };
        } catch (err) {
            console.warn('[INCREMENTAL-SYNC] Supabase incremental sync failed, trying Firestore:', err);
        }
    }

    if (firebaseDb) {
        try {
            const qOrders = query(
                collection(firebaseDb, 'orders'),
                where('store_id', '==', cleanStoreId),
                where('updatedAt', '>', lastSyncIsoTimestamp)
            );
            const snapOrders = await getDocs(qOrders);
            updatedOrders = snapOrders.docs.map(d => d.data() as Order);

            const qReqs = query(
                collection(firebaseDb, 'partner_requests'),
                where('storeId', '==', cleanStoreId),
                where('createdAt', '>', lastSyncIsoTimestamp)
            );
            const snapReqs = await getDocs(qReqs);
            updatedPartnerRequests = snapReqs.docs.map(d => d.data() as PartnerPortalRequest);
        } catch (err) {
            console.warn('[INCREMENTAL-SYNC] Firestore incremental sync error:', err);
        }
    }

    return { updatedOrders, updatedPartnerRequests, timestamp: currentIso };
};


/**
 * Fetches all stores settings (lightweight) to allow cross-store aggregation for merchants.
 */
export const getAllStoresSettings = async (): Promise<Record<string, any>> => {
    const results: Record<string, any> = {};

    // 1. Try Supabase first for efficiency if available
    const supabase = getSupabaseClient();
    if (supabase) {
        try {
            const { data, error } = await supabase.from('stores_data').select('id, settings');
            if (!error && data) {
                data.forEach(row => {
                    if (row.settings) results[row.id] = row.settings;
                });
            }
        } catch (err) {
            console.warn('[DB] Supabase error in getAllStoresSettings:', err);
        }
    }

    // 2. Fallback to Firestore
    if (firebaseDb) {
        try {
            const snap = await getDocs(collection(firebaseDb, 'stores_data'));
            snap.forEach(doc => {
                const data = doc.data();
                if (data?.settings && !results[doc.id]) {
                    results[doc.id] = data.settings;
                }
            });
        } catch (err) {
            console.warn('[DB] Error fetching all stores settings from Firestore:', err);
        }
    }

    // 3. Fallback to local Dexie IndexedDB
    try {
        if (localDb && localDb.settings) {
            const allLocal = await localDb.settings.toArray();
            allLocal.forEach((item: any) => {
                if (item?.id && item.id !== 'global' && item?.data && !results[item.id]) {
                    results[item.id] = item.data;
                }
            });
        }
    } catch (err) {
        console.warn('[DB] Error reading local Dexie settings in getAllStoresSettings:', err);
    }

    // 4. Fallback to localStorage backups
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith('emergency_store_backup_') || key.startsWith('store_data_'))) {
                    const raw = localStorage.getItem(key);
                    if (raw) {
                        try {
                            const parsed = JSON.parse(raw);
                            const sId = key.replace('emergency_store_backup_', '').replace('store_data_', '');
                            if (parsed?.settings && !results[sId]) {
                                results[sId] = parsed.settings;
                            }
                        } catch (_) {}
                    }
                }
            }
        }
    } catch (_) {}

    return results;
};

/**
 * Specifically finds all products across all stores that belong to or are shared with a merchant.
 */
export const getMerchantAllocatedProducts = async (merchantId: string, merchantName?: string): Promise<Product[]> => {
    const prodsMap = new Map<string, Product>();
    const mName = merchantName ? normalizeMerchantLabel(merchantName) : '';
    const mId = merchantId ? String(merchantId).trim().toLowerCase() : '';
    
    if (!mId && !mName) return [];

    const candidateIds = new Set<string>();
    if (mId) candidateIds.add(mId);

    // 1. Efficient query via Firestore "products" collection
    if (firebaseDb && mId) {
        try {
            const q1 = query(collection(firebaseDb, 'products'), where('merchantId', '==', mId));
            const snap1 = await getDocs(q1);
            snap1.forEach(d => prodsMap.set(d.id, { id: d.id, ...d.data() } as Product));

            const q2 = query(collection(firebaseDb, 'products'), where('merchantIds', 'array-contains', mId));
            const snap2 = await getDocs(q2);
            snap2.forEach(d => prodsMap.set(d.id, { id: d.id, ...d.data() } as Product));
        } catch (err) {
            console.warn('[DB] Firestore products collection query failed:', err);
        }
    }

    // 2. Efficient query via Supabase if active
    const supabase = getSupabaseClient();
    if (supabase) {
        try {
            // A. Search by explicit ID columns
            if (mId) {
                const { data, error } = await supabase.from('products').select('*').or(`merchant_id.eq.${mId},merchantId.eq.${mId}`);
                if (!error && data) {
                    data.forEach(p => prodsMap.set(p.id, p as Product));
                }
            }

            // B. Search by merchant name inside the details JSONB column
            // We use keyword search for common merchant fields to be thorough
            if (mName) {
                // Fetch products where merchantName or merchant_name matches
                const { data: nameData, error: nameError } = await supabase
                    .from('products')
                    .select('*')
                    .or(`details->>merchantName.ilike.%${mName}%,details->>merchant_name.ilike.%${mName}%`);
                
                if (!nameError && nameData) {
                    nameData.forEach(p => {
                        const pMName = normalizeMerchantLabel(p.merchantName || p.merchant_name || p.details?.merchantName || p.details?.merchant_name || '');
                        if (pMName && (pMName === mName || pMName.includes(mName) || mName.includes(pMName))) {
                            prodsMap.set(p.id, p as Product);
                        }
                    });
                }
            }
        } catch (err) {
             console.warn('[DB] Supabase products query failed:', err);
        }
    }

    // 3. Fallback: Full scan of all store settings (handles local data and settings-embedded products)
    const allSettings = await getAllStoresSettings();

    // Harvest all candidate IDs matching merchant name across all store partners & suppliers to expand ID search
    Object.values(allSettings).forEach(st => {
        const sups = Array.isArray(st?.suppliers) ? st.suppliers : [];
        const parts = Array.isArray(st?.partners) ? st.partners : [];
        [...sups, ...parts].forEach((e: any) => {
            const eName = normalizeMerchantLabel(e?.name || '');
            if (mName && eName && (eName === mName || eName.includes(mName) || mName.includes(eName))) {
                if (e?.id) candidateIds.add(String(e.id).trim().toLowerCase());
            }
        });
    });

    Object.values(allSettings).forEach(settings => {
        const productsList = Array.isArray(settings?.products) ? settings.products : [];
        productsList.forEach((p: any) => {
            if (prodsMap.has(p.id)) return;

            const pMId = String(p.merchantId || p.supplierId || '').trim().toLowerCase();
            const pMName = normalizeMerchantLabel(p.merchantName || p.supplierName || '');
            
            const hasInIds = Array.isArray(p.merchantIds) && p.merchantIds.some((id: any) => candidateIds.has(String(id).trim().toLowerCase()));
            const hasInAllocations = Array.isArray(p.merchantAllocations) && p.merchantAllocations.some((a: any) => {
                const aId = String(a.merchantId || '').trim().toLowerCase();
                const aName = normalizeMerchantLabel(a.merchantName || '');
                return (aId && (candidateIds.has(aId) || (mId && aId === mId))) || (mName && aName && (aName === mName || aName.includes(mName) || mName.includes(aName)));
            });

            const matchPrimaryId = Boolean(mId && pMId && (pMId === mId || candidateIds.has(pMId)));
            const matchPrimaryName = Boolean(mName && pMName && (pMName === mName || pMName.includes(mName) || mName.includes(pMName)));

            if (matchPrimaryId || matchPrimaryName || hasInIds || hasInAllocations) {
                prodsMap.set(p.id, p);
            }
        });
    });

    return Array.from(prodsMap.values());
};

// --- Migration Tool for Hostinger ---
export const pushLocalToHostinger = async (storeId: string, storeName: string, data: StoreData): Promise<{ success: boolean; error?: string }> => {
  try {
    const payload = {
      storeId,
      storeName,
      data: {
        settings: data.settings,
        orders: data.orders,
        merchantRequests: data.merchantRequests || [],
        wallet: data.wallet,
        treasury: data.treasury
      }
    };

    const res = await fetch('/api/mysql/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (!result.success) throw new Error(result.error);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};
