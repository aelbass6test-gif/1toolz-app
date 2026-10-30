import { db as localDb } from '../src/lib/db';
import { createClient } from '@supabase/supabase-js';
import { db as firebaseDb } from './firebaseClient';
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
    CallScript,
    PartnerPortalRequest
} from '../types';
export type { PartnerPortalRequest } from '../types';
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
let publicSupabaseSingleton: any = null;
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

/**
 * Legacy per-store Supabase credentials are intentionally ignored.
 * All tenants must use the single deployment-configured Supabase project.
 * Kept as a no-op while old callers are removed from store hydration.
 */
export const syncSupabaseCredentials = (_storeId: string, _settings: any) => {
    // Deliberately no-op: never persist tenant-provided database URLs or keys.
};

export const getSupabasePublicClient = () => {
    if (typeof window === 'undefined') return null;
    const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
    const envKey =
        (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
        (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
        '';
    if (!envUrl || !envKey || !/^https:\/\//.test(envUrl)) {
        publicSupabaseSingleton = null;
        return null;
    }
    if (publicSupabaseSingleton && publicSupabaseSingleton.__url === envUrl && publicSupabaseSingleton.__key === envKey) {
        return publicSupabaseSingleton;
    }
    try {
        const client = createClient(envUrl, envKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        });
        (client as any).__url = envUrl;
        (client as any).__key = envKey;
        publicSupabaseSingleton = client;
        return client;
    } catch (e) {
        console.error('Failed to initialize the public Supabase client', e);
        return null;
    }
};

export const getSupabaseClient = () => {
    if (typeof window === 'undefined') return null;
    const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
    const envKey =
        (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
        (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
        '';

    if (!envUrl || !envKey || !/^https:\/\//.test(envUrl)) {
        supabaseSingleton = null;
        return null;
    }

    if (supabaseSingleton && supabaseSingleton.__url === envUrl && supabaseSingleton.__key === envKey) {
        return supabaseSingleton;
    }

    try {
        const client = createClient(envUrl, envKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                flowType: 'pkce'
            }
        });
        (client as any).__url = envUrl;
        (client as any).__key = envKey;
        supabaseSingleton = client;
        return supabaseSingleton;
    } catch (e) {
        console.error('Failed to initialize the deployment Supabase client', e);
        return null;
    }
};

export const isSupabaseActive = (): boolean => {
    if (typeof window === 'undefined') return false;
    const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
    const envKey =
        (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
        (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
        '';
    return !!envUrl && !!envKey && /^https:\/\//.test(envUrl);
};

/**
 * Verify only the deployment-configured Supabase project.
 * The URL/key arguments remain for compatibility with legacy settings screens,
 * but tenant-provided credentials are never instantiated or accepted.
 */
export const verifySupabaseConnection = async (_url?: string, _key?: string): Promise<{ success: boolean; error?: string }> => {
    const client = getSupabaseClient();
    if (!client) {
        return { success: false, error: 'Supabase deployment environment variables are not configured.' };
    }
    try {
        const { error } = await client.from('stores_data').select('id').limit(1);
        if (error) {
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Unable to reach the configured Supabase project.' };
    }
};

// --- Hostinger MySQL Support ---

export const isHostingerActive = (): boolean => {
  return localStorage.getItem('custom_cloud_provider') === 'hostinger';
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
    const errInfo = {
        error: err instanceof Error ? err.message : String(err),
        operationType: operation,
        path,
        authInfo: { provider: 'supabase-auth' }
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
    return localStorage.getItem('supabase_restricted') === 'true';
};

export const setSupabaseRestricted = (restricted: boolean) => {
    localStorage.setItem('supabase_restricted', String(restricted));
};

export const isRestrictionError = (error: any): boolean => {
    const msg = String(error?.message || error).toLowerCase();
    return msg.includes('permission') || msg.includes('access') || msg.includes('unauthorized') || msg.includes('restricted');
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
const WITH_TIMEOUT = <T>(promise: Promise<T>, timeoutMs: number = 5000): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('العملية السحابية استغرقت وقتاً طويلاً')), timeoutMs))
    ]);
};

// --- Sync Optimizations: Memory-Hash Cache & ID Tracking to Prevent Duplicate Firestore Reads/Writes & Accidental Deletions ---
const LAST_SYNCED_HASHES: Record<string, string> = {};
const LAST_KNOWN_DOC_IDS: Record<string, Set<string>> = {};

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
    const allowedCollections = new Set([
        'products', 'orders', 'transactions', 'treasury_accounts', 'treasury_transactions',
        'suppliers', 'supply_orders', 'reviews', 'abandoned_carts', 'activity_logs',
        'employees', 'discount_codes', 'collections', 'custom_pages', 'payment_methods',
        'customers', 'global_options', 'shipping_integrations', 'partners',
        'partner_transactions', 'warehouses', 'inventory_audits', 'stock_transfers',
        'order_returns', 'purchase_returns', 'pos_sales', 'cash_holders',
        'cash_handovers', 'whatsapp_templates', 'call_scripts', 'quotations'
    ]);
    if (!allowedCollections.has(collectionName)) {
        console.warn(`[deleteStoreItem] Rejected unsupported table: ${collectionName}`);
        return false;
    }

    const supabase = getSupabaseClient();
    if (!supabase) return false;

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

        const ids = Array.from(new Set([docId, rawId]));
        const { error } = await supabase
            .from(collectionName)
            .delete()
            .eq('store_id', storeId)
            .in('id', ids);
        if (error) throw error;

        const localData = await getLocal(storeId);
        if (localData) {
            if (collectionName === 'orders' && Array.isArray(localData.orders)) {
                localData.orders = localData.orders.filter((o: any) => {
                    const id = String(o?.id || '');
                    const number = String(o?.orderNumber || '');
                    return !ids.includes(id) && !ids.includes(number);
                });
            }
            if (collectionName === 'suppliers' || collectionName === 'partners') {
                const key = collectionName;
                if (Array.isArray(localData.settings?.[key])) {
                    localData.settings[key] = localData.settings[key].filter((item: any) => !ids.includes(String(item?.id || '')));
                }
                if (Array.isArray((localData as any)[key])) {
                    (localData as any)[key] = (localData as any)[key].filter((item: any) => !ids.includes(String(item?.id || '')));
                }
            }
            await saveLocal(storeId, localData);
        }

        return true;
    } catch (e) {
        console.error(`[deleteStoreItem] Supabase delete failed for ${collectionName}/${itemId}:`, e);
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
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, error: 'Supabase client not initialized.' };

    try {
        const { data, error } = await supabase.rpc('ensure_store_record_for_current_user', {
            p_store_id: storeId,
            p_store_name: storeName
        });
        if (error) return { success: false, error: error.message };
        if (data !== true) {
            return { success: false, error: 'المتجر موجود بالفعل ولا تملك عضوية معتمدة عليه.' };
        }
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err?.message || 'تعذر إنشاء سجل المتجر أو التحقق من عضويتك.' };
    }
};

export const getStoreData = async (storeId: string, forceRemote: boolean = false): Promise<StoreData | null> => {
    const supabase = getSupabaseClient();
    const publicSupabase = getSupabasePublicClient();
    let isAuthenticated = false;
    let isStoreMember = false;
    if (supabase) {
        try {
            const { data: authData } = await supabase.auth.getUser();
            isAuthenticated = Boolean(authData?.user);
            if (isAuthenticated) {
                const { data: membership } = await supabase
                    .from('store_memberships')
                    .select('store_id')
                    .eq('store_id', storeId)
                    .eq('user_id', authData.user.id)
                    .maybeSingle();
                isStoreMember = Boolean(membership?.store_id);
            }
        } catch {
            isAuthenticated = false;
            isStoreMember = false;
        }
    }

    const canAccessPrivateStoreData = isAuthenticated && isStoreMember;

    // Never hydrate a public storefront from a private IndexedDB cache unless
    // the current authenticated user has a verified membership for this store.
    const local = canAccessPrivateStoreData ? await getLocal(storeId) : null;

    // Verified store members retain offline-first behavior.
    if (canAccessPrivateStoreData && !forceRemote && local) {
        if (local.settings) {
            syncSupabaseCredentials(storeId, local.settings);
        }
        return local;
    }

    // --- Custom Hostinger MySQL Fetch Logic ---
    if (canAccessPrivateStoreData && isHostingerActive()) {
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
          const fullData: StoreData = {
            settings: { ...INITIAL_SETTINGS, ...storeSettings, products, suppliers, partners, supplyOrders },
            orders,
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
    const queryClient = canAccessPrivateStoreData ? supabase : publicSupabase;
    if (queryClient) {
        try {
            const publicStorefrontViews: Record<string, string> = {
                products: 'public_storefront_products',
                collections: 'public_storefront_collections',
                custom_pages: 'public_storefront_pages',
                payment_methods: 'public_storefront_payment_methods',
                reviews: 'public_storefront_reviews',
                discount_codes: 'public_storefront_discount_codes'
            };

            const fetchTable = async (table: string) => {
                const queryTable = canAccessPrivateStoreData ? table : publicStorefrontViews[table];
                if (!queryTable || knownMissingTables.has(table)) {
                    return [];
                }
                try {
                    const storeIdColumn = table === 'employees' ? 'store_id' : 'storeId';
                    const { data, error } = await queryClient.from(queryTable).select('*').eq(storeIdColumn, storeId);
                    if (error) {
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
                    console.warn(`[SUPABASE-FETCH] Could not fetch ${table}:`, fetchErr?.message || fetchErr);
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
                canAccessPrivateStoreData
                    ? queryClient.from('stores_data').select('*').eq('id', storeId).maybeSingle()
                    : queryClient.from('public_storefronts').select('*').eq('id', storeId).maybeSingle()
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
                        const { passcode: _legacySupplierPasscode, password: _legacySupplierPassword, ...safeSupplierDetails } = details;
                        const { passcode: _recordSupplierPasscode, password: _recordSupplierPassword, details: _rawSupplierDetails, ...safeSupplierRecord } = s;
                        const { passcode: _fallbackSupplierPasscode, password: _fallbackSupplierPassword, details: _fallbackSupplierDetails, ...safeFallbackSupplier } = fallbackSupplier || {};
                        return {
                            ...safeFallbackSupplier,
                            ...safeSupplierRecord,
                            details: safeSupplierDetails,
                            email: s.email || safeSupplierDetails.email || safeFallbackSupplier.email || '',
                            // PIN/password credentials must never enter the browser store model.
                            passcode: '',
                            payoutAccounts: s.payoutAccounts || safeSupplierDetails.payoutAccounts || safeFallbackSupplier.payoutAccounts || {},
                            profitRatio: Number(s.profitRatio ?? s.profit_ratio ?? safeSupplierDetails.profitRatio ?? safeFallbackSupplier.profitRatio ?? 0),
                            transactions: Array.isArray(s.transactions) && s.transactions.length > 0 ? s.transactions : (safeFallbackSupplier.transactions || [])
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
                    employees: employees.length > 0 ? employees.map((employee: any) => ({ ...employee, id: employee.id || employee.phone, phone: employee.phone || employee.id })) : (storeSettings.employees || local?.settings?.employees || []),
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
                        // Legacy partner credentials are not an authentication source.
                        // Keep password/PIN values out of the client-side store model.
                        const { password: _fallbackPassword, passcode: _fallbackPasscode, details: _fallbackDetails, ...safeFallbackPartner } = fallbackPartner || {};
                        const { password: _legacyPassword, passcode: _legacyPasscode, details: _rawDetails, ...safePartnerRecord } = p;
                        const parsedDetails = p.details && typeof p.details === 'object' ? p.details : (typeof p.details === 'string' && p.details ? JSON.parse(p.details) : {});
                        const { password: _legacyDetailsPassword, passcode: _legacyDetailsPasscode, ...safeDetails } = parsedDetails;
                        return {
                            ...safeFallbackPartner,
                            ...safePartnerRecord,
                            details: safeDetails,
                            email: p.email || safeDetails.email || safeFallbackPartner.email || '',
                            passcode: '',
                            requireEmailOtp: Boolean(p.requireEmailOtp ?? p.require_email_otp ?? safeDetails.requireEmailOtp ?? safeFallbackPartner.requireEmailOtp ?? true),
                            isEmailVerified: Boolean(p.isEmailVerified ?? p.is_email_verified ?? safeDetails.isEmailVerified ?? safeFallbackPartner.isEmailVerified ?? false),
                            emailVerifiedAt: p.emailVerifiedAt || p.email_verified_at || safeDetails.emailVerifiedAt || safeFallbackPartner.emailVerifiedAt,
                            lastLoginAt: p.lastLoginAt || p.last_login_at || safeDetails.lastLoginAt || safeFallbackPartner.lastLoginAt,
                            permissions: p.permissions || safeDetails.permissions || safeFallbackPartner.permissions || {},
                            portalPermissions: p.portalPermissions || safeDetails.portalPermissions || safeFallbackPartner.portalPermissions || {},
                            payoutAccounts: p.payoutAccounts || safeDetails.payoutAccounts || safeFallbackPartner.payoutAccounts || {},
                            biometricCredentials: p.biometricCredentials || safeDetails.biometricCredentials || safeFallbackPartner.biometricCredentials || [],
                            allowBiometricAuth: Boolean(p.allowBiometricAuth ?? safeDetails.allowBiometricAuth ?? safeFallbackPartner.allowBiometricAuth ?? false)
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
                    const cloudOrderIds = new Set((orders || []).map((o: any) => String(o?.id || '').trim()));
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

                    const localOnlyOrders = (local?.orders || []).filter((lo: any) => lo && lo.id && !cloudOrderIds.has(String(lo.id).trim()));
                    return [...mappedCloudOrders, ...localOnlyOrders];
                })(),
                wallet: {
                    balance: Number(storeSettings.wallet_balance ?? 0),
                    transactions,
                    withdrawRequests: Array.isArray(storeSettings.withdraw_requests) ? storeSettings.withdraw_requests : [],
                    settings: storeSettings.wallet_settings || undefined,
                    supplyBalance: Number(storeSettings.supply_balance ?? 0)
                },
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
        } catch (e) {
            console.error('Supabase fetch failed, falling back to local/Firestore', e);
        }
    }

    // Firebase is intentionally not a data source after the Supabase cutover.
    // Keep a verified member's local cache only when the remote read fails.
    return canAccessPrivateStoreData ? local : null;
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
    if (supabase) {
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
                    throw storesDataErr;
                }
            }

            // 2. Synchronize Users only when user list actually changes (Fingerprinted)
            const localGlobal = await getLocal('global');
            const usersList = localGlobal?.users || [];
            const usersFingerprint = JSON.stringify(usersList);
            const usersFingerprintKey = 'global:users_sync';
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
            } else {
                supabaseSaveSucceeded = true;
            }

            if (supabaseSaveSucceeded) {
                return { success: true };
            }
        } catch (e: any) {
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

    if (!supabase) {
        return {
            success: false,
            error: 'اتصال Supabase غير مهيأ. تم الاحتفاظ بالتعديلات محليًا، ومصدر Firebase القديم متوقف في مسار الترحيل.'
        };
    }

    return { success: false, error: 'تعذر إتمام المزامنة عبر Supabase.' };
};

export const getGlobalData = async (forceRemote: boolean = false): Promise<{ users: User[], loyaltyData: any } | null> => {
    const isBrowser = typeof window !== 'undefined';
    const savedSyncMode = isBrowser ? localStorage.getItem('dbSyncMode') : 'auto';
    const shouldForce = forceRemote || (savedSyncMode === 'auto');

    if (!shouldForce) {
        const local = await getLocal('global');
        if (local && local.users && local.users.length > 0) {
            return local;
        }
    }

    try {
        const dbUsers: User[] = [];
        let supabaseUsers: User[] = [];
        const supabase = getSupabaseClient();
        if (supabase) {
            try {
                const { data: sbUsers, error: sbErr } = await supabase.from('users').select('phone,full_name,email,is_admin,is_banned,join_date,stores,sites,default_store_id,auto_launch_default_store,fullName,isAdmin,isBanned,joinDate');
                if (!sbErr && sbUsers) {
                    supabaseUsers = sbUsers.map((su: any) => ({
                        fullName: su.full_name || '',
                        phone: su.phone,
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
        supabaseUsers.forEach(u => { if (u && u.phone) mergedUsersMap.set(u.phone, u); });

        const finalUsers = Array.from(mergedUsersMap.values());

        // User records are read only from Supabase; local cache is retained for offline recovery.

        const globalData = { users: finalUsers, loyaltyData: {} } as { users: User[], loyaltyData: any };
        await saveLocal('global', globalData);
        return globalData;
    } catch (err: any) {
        return await getLocal('global') as { users: User[], loyaltyData: any } | null;
    }
};

export const saveGlobalData = async (data: { users: User[], loyaltyData: any }): Promise<{ success: boolean, error?: string }> => {
    await saveLocal('global', data);

    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, error: 'Supabase client not initialized.' };

    try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
            return { success: false, error: 'يجب تسجيل الدخول بحساب Supabase قبل حفظ بيانات المستخدم.' };
        }

        const phone = String(authData.user.user_metadata?.phone || '').trim();
        if (!phone) {
            return { success: false, error: 'رقم الهاتف غير مرتبط بهوية Supabase الحالية.' };
        }

        const ownProfile = data.users.find(user => user.phone === phone);
        if (!ownProfile) {
            return { success: false, error: 'لم يتم العثور على ملف المستخدم الحالي ضمن البيانات.' };
        }

        // Browser sessions may update only their own profile. Privileged account
        // flags and other users' records require a trusted server-side admin flow.
        const result = await updateUserInSupabase(ownProfile);
        if (!result.success) return { success: false, error: result.error || 'تعذر حفظ ملف المستخدم.' };
        return { success: true };
    } catch (err: any) {
        console.error('[SUPABASE] Error saving authenticated user profile:', err);
        return { success: false, error: err?.message || 'تعذر حفظ بيانات المستخدم.' };
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
        const { data, error } = await supabase.from('users').select('phone,full_name,email,is_admin,is_banned,join_date,stores,sites,fullName,isAdmin,isBanned,joinDate').eq('phone', phone).maybeSingle();
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
            join_date: user.joinDate || new Date().toISOString(),
            stores: user.stores || [],
            sites: user.sites || [],
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
    const cleanPhone = String(phone || '').trim();
    if (!cleanPhone) return null;

    try {
        const remoteUser = await getUserByPhoneFromSupabase(cleanPhone);
        if (remoteUser) return remoteUser;
    } catch (error) {
        console.warn('[DATABASE-SERVICE] Supabase user lookup failed:', error);
    }

    try {
        const cachedUserStr = localStorage.getItem('user_session_v4') || localStorage.getItem('currentUser');
        if (cachedUserStr) {
            const cached = JSON.parse(cachedUserStr);
            if (cached && (cached.phone === cleanPhone || cached.phone === cleanPhone.replace(/^0+/, ''))) return cached;
        }
    } catch (_) {}

    return null;
};

export const createUserDoc = async (user: User): Promise<boolean> => {
    const supabase = getSupabaseClient();
    if (!supabase) {
        console.error('[SUPABASE] Cannot create a user profile: deployment Supabase client is unavailable.');
        return false;
    }

    try {
        const supabasePayload = {
            full_name: user.fullName,
            phone: user.phone,
            email: user.email,
            stores: user.stores || [],
            sites: user.sites || [],
            join_date: user.joinDate || new Date().toISOString(),
            default_store_id: user.defaultStoreId || null,
            auto_launch_default_store: user.autoLaunchDefaultStore ?? Boolean(user.defaultStoreId)
        };

        const { error } = await supabase.from('users').upsert(supabasePayload, { onConflict: 'phone' });
        if (error) {
            console.error('[SUPABASE] Failed to persist user profile:', error.message, error.details, error.hint);
            return false;
        }
        return true;
    } catch (err) {
        console.error('[SUPABASE] Error creating user profile:', err);
        return false;
    }
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

        // Supabase is the sole cloud source of truth for partner requests.
        const supabase = getSupabaseClient();
        if (!supabase) return { success: false, error: 'اتصال Supabase غير متاح؛ تم الاحتفاظ بالطلب محلياً للمزامنة لاحقاً.' };

        const { error } = await supabase.from('partner_requests').upsert(cleanUndefined(fullRequest), { onConflict: 'id' });
        if (error) {
            console.error('[PARTNER-REQUEST] Supabase upsert failed:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err: any) {
        console.error('[PARTNER-REQUEST] Error submitting partner request:', err);
        return { success: false, error: err.message };
    }
};

export const getPartnerRequests = async (storeId: string): Promise<PartnerPortalRequest[]> => {
    let requests: PartnerPortalRequest[] = [];
    
    // 1. Try local storage first
    try {
        const localKey = `partner_requests_${storeId}`;
        const local = JSON.parse(localStorage.getItem(localKey) || '[]');
        if (Array.isArray(local) && local.length > 0) {
            requests = local;
        }
    } catch (_) {}

    // 2. Try Supabase
    const supabase = getSupabaseClient();
    let supabaseSuccess = false;
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('partner_requests')
                .select('*')
                .eq('storeId', storeId);
            if (!error && data) {
                requests = data as PartnerPortalRequest[];
                requests.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
                supabaseSuccess = true;
                try { localStorage.setItem(`partner_requests_${storeId}`, JSON.stringify(requests)); } catch (_) {}
            }
        } catch (err) {
            console.warn('[PARTNER-REQUEST] Supabase read failed:', err);
        }
    }

    return requests;
};

export const updatePartnerRequestStatus = async (
    requestId: string,
    storeId: string,
    status: 'approved' | 'rejected' | 'processing' | 'pending',
    meta?: { receiptImage?: string; transferReference?: string; approvedBy?: string; approvedAt?: string }
): Promise<boolean> => {
    try {
        const extraFields = cleanUndefined({
            ...(meta?.receiptImage ? { receiptImage: meta.receiptImage } : {}),
            ...(meta?.transferReference ? { transferReference: meta.transferReference } : {}),
            ...(meta?.approvedBy ? { approvedBy: meta.approvedBy } : {}),
            ...(meta?.approvedAt ? { approvedAt: meta.approvedAt } : {})
        });

        const supabase = getSupabaseClient();
        if (!supabase) return false;
        const { data: updatedRows, error } = await supabase
            .from('partner_requests')
            .update({ status, updated_at: new Date().toISOString(), ...extraFields })
            .eq('id', requestId)
            .eq('storeId', storeId)
            .eq('status', 'pending')
            .select('id');
        if (error) {
            console.error('[PARTNER-REQUEST] Supabase status update failed:', error);
            return false;
        }
        if (!updatedRows?.length) return false;

        try {
            const localKey = `partner_requests_${storeId}`;
            const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
            const matchingRequest = existing.find((r: any) => r.id === requestId && r.storeId === storeId);
            if (!matchingRequest) return true;
            const updated = existing.map((r: any) => r.id === requestId ? { ...r, status, ...extraFields } : r);
            localStorage.setItem(localKey, JSON.stringify(updated));
        } catch (_) {}

        return true;
    } catch (err) {
        console.error('[PARTNER-REQUEST] Error updating partner request status:', err);
        return false;
    }
};

export const deletePartnerRequestDoc = async (requestId: string, storeId: string): Promise<boolean> => {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) return false;
        const { data: deletedRows, error } = await supabase.from('partner_requests').delete().eq('id', requestId).eq('storeId', storeId).select('id');
        if (error) {
            console.error('[PARTNER-REQUEST] Supabase delete failed:', error);
            return false;
        }

        if (!deletedRows?.length) return false;

        try {
            const localKey = `partner_requests_${storeId}`;
            const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
            const updated = existing.filter((r: any) => r.id !== requestId);
            localStorage.setItem(localKey, JSON.stringify(updated));
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
    partnerId: String(raw.merchantId ?? raw.partnerId ?? ''),
    partnerName: String(raw.merchantName ?? raw.partnerName ?? ''),
    isMerchantRequest: true,
    transferFee: raw.details?.transferFee,
    netAmount: raw.details?.netAmount,
    payoutFrequency: raw.details?.payoutFrequency,
    legacySource
} as PartnerPortalRequest);

const isLegacyMerchantRequest = (r: any): boolean => Boolean(r && (
    r.isMerchantRequest === true ||
    String(r.id || '').startsWith('REQ-M-') ||
    String(r.typeArabic || '').includes('الموكل') ||
    String(r.partnerId || '').startsWith('m_') ||
    String(r.partnerId || '').startsWith('sup_')
));

export const submitMerchantRequest = async (
    storeIdOrObj: string | (Partial<PartnerPortalRequest> & { storeId: string }),
    maybeReq?: Partial<PartnerPortalRequest>
): Promise<{ success: boolean; error?: string; request?: any }> => {
    try {
        const isObjFirst = typeof storeIdOrObj === 'object' && storeIdOrObj !== null;
        const storeId = isObjFirst ? String(storeIdOrObj.storeId || '') : String(storeIdOrObj || '');
        const rawReq: any = isObjFirst ? storeIdOrObj : (maybeReq || {});
        if (!storeId) return { success: false, error: 'Missing storeId' };
        const supabase = getSupabaseClient();
        if (!supabase) return { success: false, error: 'اتصال قاعدة البيانات غير متاح' };
        const merchantId = String(rawReq.merchantId || rawReq.partnerId || '');
        const passcode = String(rawReq.merchantPasscode || '');
        if (!merchantId || !passcode) return { success: false, error: 'انتهت جلسة الموكل. سجل الدخول مرة أخرى.' };

        const { data, error } = await supabase.functions.invoke('merchant-portal-requests', {
            body: {
                action: 'submit',
                storeId,
                merchantId,
                passcode,
                request: {
                    amount: Number(rawReq.amount || 0),
                    notes: String(rawReq.notes || ''),
                    typeArabic: String(rawReq.typeArabic || 'طلب سحب مستحقات'),
                    payoutMethod: String(rawReq.payoutMethod || ''),
                    payoutAccount: String(rawReq.payoutAccount || ''),
                    transferFee: Number(rawReq.transferFee || 0),
                    netAmount: Number(rawReq.netAmount ?? rawReq.amount ?? 0),
                    payoutFrequency: String(rawReq.payoutFrequency || '')
                }
            }
        });
        if (error || !data?.success) {
            return { success: false, error: data?.error || error?.message || 'تعذر حفظ طلب السحب' };
        }

        const { merchantPasscode: _merchantPasscode, ...safeRawReq } = rawReq;
        const request = {
            ...safeRawReq,
            id: data.id,
            storeId,
            merchantId,
            partnerId: merchantId,
            status: 'pending',
            createdAt: new Date().toISOString(),
            date: new Date().toISOString(),
            isMerchantRequest: true
        };
        try {
            const key = `merchant_requests_${storeId}`;
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            localStorage.setItem(key, JSON.stringify([request, ...existing.filter((r: any) => r.id !== request.id)]));
        } catch (_) {}
        return { success: true, request };
    } catch (err: any) {
        console.error('[MERCHANT-REQUEST] Error submitting merchant request:', err);
        return { success: false, error: err?.message || 'Unable to submit request' };
    }
};

export const getMerchantRequests = async (storeId: string, options?: { merchantId?: string; passcode?: string; forceAdmin?: boolean }): Promise<PartnerPortalRequest[]> => {
    const key = `merchant_requests_${storeId}`;
    const supabase = getSupabaseClient();
    if (!supabase) {
        try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
    }

    let merchantId = options?.merchantId || '';
    let passcode = options?.passcode || '';
    if (!options?.forceAdmin && (!merchantId || !passcode)) {
        try {
            const session = JSON.parse(localStorage.getItem(`authenticated_merchant_${storeId}`) || 'null');
            merchantId = merchantId || String(session?.id || '');
            passcode = passcode || String(session?.passcode || '');
        } catch (_) {}
    }

    if (options?.forceAdmin) {
        const { data, error } = await supabase.functions.invoke('merchant-portal-requests', {
            body: { action: 'admin_list', storeId }
        });
        if (error || !data?.success) {
            console.error('[MERCHANT-REQUEST] Admin read failed:', data?.error || error?.message);
            throw new Error(data?.error || error?.message || 'تعذر تحميل طلبات السحب للإدارة');
        }
        const requests = (data.requests || []).map((r: any) => toMerchantRequestView(r, 'merchant_requests'));
        try { localStorage.setItem(key, JSON.stringify(requests)); } catch (_) {}
        return requests;
    }

    if (merchantId && passcode) {
        const { data, error } = await supabase.functions.invoke('merchant-portal-requests', {
            body: { action: 'list', storeId, merchantId, passcode }
        });
        if (error || !data?.success) {
            console.error('[MERCHANT-REQUEST] Secure portal read failed:', data?.error || error?.message);
            try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
        }
        const requests = (data.requests || []).map((r: any) => toMerchantRequestView(r, 'merchant_requests'));
        try { localStorage.setItem(key, JSON.stringify(requests)); } catch (_) {}
        return requests;
    }

    try {
        const { data, error } = await supabase
            .from('merchant_requests')
            .select('*')
            .eq('storeId', storeId)
            .order('createdAt', { ascending: false });
        if (error) throw error;
        const requests = (data || []).map((r: any) => toMerchantRequestView(r, 'merchant_requests'));
        try { localStorage.setItem(key, JSON.stringify(requests)); } catch (_) {}
        return requests;
    } catch (err) {
        console.error('[MERCHANT-REQUEST] Supabase read failed:', err);
        try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
    }
};

export const updateMerchantRequestStatus = async (
    requestId: string,
    storeId: string,
    status: 'approved' | 'rejected' | 'processing' | 'pending',
    meta?: { receiptImage?: string; transferReference?: string; approvedBy?: string; approvedAt?: string },
    merchantAuth?: { merchantId: string; passcode: string }
): Promise<boolean> => {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    try {
        const extra = cleanUndefined({
            ...(meta?.receiptImage ? { receiptImage: meta.receiptImage } : {}),
            ...(meta?.transferReference ? { transferReference: meta.transferReference } : {}),
            ...(meta?.approvedBy ? { approvedBy: meta.approvedBy } : {}),
            ...(meta?.approvedAt ? { approvedAt: meta.approvedAt } : {})
        });
        const { data, error } = await supabase.functions.invoke('merchant-portal-requests', {
            body: merchantAuth
                ? { action: 'merchant_cancel', storeId, requestId, merchantId: merchantAuth.merchantId, passcode: merchantAuth.passcode }
                : status === 'processing'
                    ? { action: 'admin_claim', storeId, requestId }
                    : { action: 'admin_update', storeId, requestId, status, meta: extra }
        });
        if (error || !data?.success) throw new Error(data?.error || error?.message || 'تعذر تحديث طلب السحب');

        try {
            const key = `merchant_requests_${storeId}`;
            const rows = JSON.parse(localStorage.getItem(key) || '[]');
            localStorage.setItem(key, JSON.stringify(rows.map((r: any) =>
                r.id === requestId ? { ...r, status, ...extra } : r
            )));
        } catch (_) {}
        return true;
    } catch (err) {
        console.error('[MERCHANT-REQUEST] Supabase status update failed:', err);
        return false;
    }
};

export const completeMerchantWithdrawal = async (
    requestId: string,
    storeId: string,
    transferFee: number,
    meta?: { receiptImage?: string; transferReference?: string; approvedBy?: string; approvedAt?: string }
): Promise<{ success: boolean; error?: string; balanceAfter?: number }> => {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, error: 'Supabase connection unavailable' };
    try {
        const { data, error } = await supabase.functions.invoke('merchant-portal-requests', {
            body: {
                action: 'admin_complete_withdrawal',
                storeId,
                requestId,
                transferFee,
                meta: cleanUndefined(meta || {})
            }
        });
        if (error || !data?.success) {
            return { success: false, error: data?.error || error?.message || 'تعذر اعتماد السحب وتحديث المحفظة' };
        }
        try {
            const key = `merchant_requests_${storeId}`;
            const rows = JSON.parse(localStorage.getItem(key) || '[]');
            localStorage.setItem(key, JSON.stringify(rows.map((r: any) =>
                r.id === requestId ? { ...r, status: 'approved', ...meta } : r
            )));
        } catch (_) {}
        return { success: true, balanceAfter: Number(data.balanceAfter) };
    } catch (err: any) {
        console.error('[MERCHANT-WITHDRAWAL] Atomic completion failed:', err);
        return { success: false, error: err?.message || 'تعذر اعتماد السحب' };
    }
};

export const deleteMerchantRequestDoc = async (requestId: string, storeId: string): Promise<boolean> => {
    try {
        let found = false;
        const supabase = getSupabaseClient();
        if (!supabase) return false;

        const [merchantDelete, partnerDelete] = await Promise.all([
            supabase.from('merchant_requests').delete().eq('id', requestId).eq('storeId', storeId).select('id'),
            supabase.from('partner_requests').delete().eq('id', requestId).eq('storeId', storeId).select('id')
        ]);
        if (merchantDelete.error || partnerDelete.error) {
            console.error('[MERCHANT-REQUEST] Supabase delete failed:', merchantDelete.error || partnerDelete.error);
            return false;
        }
        found = Boolean((merchantDelete.data?.length || 0) + (partnerDelete.data?.length || 0));
        for (const key of [`merchant_requests_${storeId}`, `partner_requests_${storeId}`]) {
            try {
                const rows = JSON.parse(localStorage.getItem(key) || '[]');
                const before = rows.length;
                const filtered = rows.filter((r: any) => r.id !== requestId || r.storeId !== storeId || (key.startsWith('partner_requests_') && !isLegacyMerchantRequest(r)));
                found = found || filtered.length !== before;
                localStorage.setItem(key, JSON.stringify(filtered));
            } catch (_) {}
        }
        return found;
    } catch (err) {
        console.error('[MERCHANT-REQUEST] Error deleting merchant request:', err);
        return false;
    }
};

export const updatePartnerSettings = async (storeId: string, partners: any[], suppliers?: any[]): Promise<{ success: boolean; error?: string }> => {
    const supabase = getSupabaseClient();
    if (!storeId || !supabase) return { success: false, error: 'Supabase connection unavailable' };
    try {
        const { data: row, error: readError } = await supabase
            .from('stores_data').select('settings').eq('id', storeId).maybeSingle();
        if (readError) throw readError;
        if (!row) return { success: false, error: 'Store not found or access denied' };

        const nextSettings: any = {
            ...(row.settings || {}),
            partners: cleanUndefined(partners || [])
        };
        if (suppliers) nextSettings.suppliers = cleanUndefined(suppliers);

        const { data: saved, error: saveError } = await supabase
            .from('stores_data')
            .update({ settings: nextSettings, updated_at: new Date().toISOString() })
            .eq('id', storeId)
            .select('id')
            .maybeSingle();
        if (saveError) throw saveError;
        if (!saved?.id) return { success: false, error: 'لم يتم حفظ بيانات الموكل في قاعدة البيانات' };

        try {
            const localData = await getLocal(storeId);
            if (localData) {
                await saveLocal(storeId, {
                    ...localData,
                    settings: {
                        ...localData.settings,
                        partners: partners || localData.settings?.partners || [],
                        ...(suppliers ? { suppliers } : {})
                    }
                });
            }
        } catch (_) {}
        return { success: true };
    } catch (err: any) {
        console.error('[DATABASE-SERVICE] Supabase partner settings update failed:', err);
        return { success: false, error: err?.message || 'Error saving merchant settings' };
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
    const tablesToListen = options.tables || ['orders', 'merchant_requests', 'partner_requests', 'products', 'transactions'];
    const unsubs: Array<() => void> = [];

    // A. Supabase Realtime Channel with Strict Row-Level Filter (.eq('store_id', cleanStoreId))
    const supabase = getSupabaseClient();
    if (supabase) {
        try {
            const channelName = `realtime_store_${cleanStoreId}_${Date.now().toString(36)}`;
            const channel = supabase.channel(channelName);

            tablesToListen.forEach(table => {
                const filterField = (table === 'partner_requests' || table === 'merchant_requests') ? 'storeId' : 'store_id';
                
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
                    console.log(`[REALTIME-OPTIMIZED] Subscribed to store '${cleanStoreId}' with strict row-level filters.`);
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

    // Firebase realtime is intentionally disabled: Supabase Realtime is the only cloud event source.
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

            if (ordersRes.error) throw ordersRes.error;
            if (reqsRes.error) throw reqsRes.error;
            if (ordersRes.data) {
                updatedOrders = ordersRes.data as Order[];
            }
            if (reqsRes.data) {
                updatedPartnerRequests = reqsRes.data as PartnerPortalRequest[];
            }

            return { updatedOrders, updatedPartnerRequests, timestamp: currentIso };
        } catch (err) {
            console.error('[INCREMENTAL-SYNC] Supabase incremental sync failed; Firebase fallback is disabled:', err);
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

    // 2. Local Dexie IndexedDB remains the offline recovery source.

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

    // Product allocation lookup uses Supabase and store settings only.
    // 1. Efficient query via Supabase if active
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
