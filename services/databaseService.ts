import { db as firebaseDb } from './firebaseClient';
import { db as localDb } from '../src/lib/db';
import { createClient } from '@supabase/supabase-js';
import { 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    deleteDoc, 
    query, 
    where, 
    getDocFromServer,
    updateDoc
} from 'firebase/firestore';
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

const LOCAL_STORAGE_PREFIX = 'wuilt_backup_';

// --- Supabase Custom Connection ---
let supabaseSingleton: any = null;

export const getSupabaseClient = () => {
    if (typeof window === 'undefined') return null;
    const url = localStorage.getItem('custom_cloud_url');
    const key = localStorage.getItem('custom_cloud_anon_key');
    
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
    return !!localStorage.getItem('custom_cloud_url') && !!localStorage.getItem('custom_cloud_anon_key');
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

// --- Error Handling & Metrics ---
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: localStorage.getItem('currentUserPhone') || null,
      email: null,
      emailVerified: null,
      isAnonymous: null
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
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
        await getDocFromServer(doc(firebaseDb, 'stores_data', 'connection_test'));
        return true;
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

        // If there's no settings in IndexedDB and no orders, we don't have this store locally at all.
        if (!settingsRecord && (!orders || orders.length === 0)) {
            // Check emergency fallback first
            const backup = localStorage.getItem(`emergency_store_backup_${key}`);
            if (backup) return JSON.parse(backup);
            return null;
        }

        // Safe fetch settings, fallback to INITIAL_SETTINGS if store was created but settings lost
        const settings = settingsRecord?.data || { ...INITIAL_SETTINGS };

        const result = {
            orders: orders || [],
            settings: settings,
            wallet: wallet || { balance: 0, transactions: [] },
            treasury: treasury,
            cart: [],
            customers: customers || []
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
            localStorage.setItem('emergency_global_backup', JSON.stringify(data));
            return;
        }

        const storeId = key;
        
        if (data.orders) {
            const ordersWithId = data.orders.map((o: any) => ({ ...o, store_id: storeId }));
            await localDb.orders.bulkPut(ordersWithId);
        }

        if (data.settings) {
            await localDb.settings.put({ id: storeId, data: data.settings } as any);
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
        
        // Final full backup to localStorage as string (limitations apply to size, but better than nothing)
        try {
            localStorage.setItem(`emergency_store_backup_${key}`, JSON.stringify(data));
        } catch (storageErr) {
            // Might fail if quota exceeded
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

// --- Sync Optimizations: Memory-Hash Cache to Prevent Duplicate Firestore Reads/Writes ---
const LAST_SYNCED_HASHES: Record<string, string> = {};

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
        const storeRef = doc(firebaseDb, 'stores_data', storeId);
        await WITH_TIMEOUT(setDoc(storeRef, { id: storeId, name: storeName }, { merge: true }));
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
};

export const getStoreData = async (storeId: string, forceRemote: boolean = false): Promise<StoreData | null> => {
    // 1. Always attempt local fetch first for offline-first resilience
    const local = await getLocal(storeId);
    
    // 2. If it's not a forced refresh, and local exists, return it immediately
    if (!forceRemote && local) {
        return local;
    }

    // --- Custom Supabase Fetch Logic ---
    const supabase = getSupabaseClient();
    if (supabase) {
        try {
            const fetchTable = async (table: string) => {
                const { data, error } = await supabase.from(table).select('*').eq('store_id', storeId);
                if (error) {
                    if (error.code === 'PGRST205' || error.code === 'PGRST116') {
                        console.warn(`Table ${table} not found in Supabase schema. Skipping fetch.`);
                        return [];
                    }
                    throw error;
                }
                return data || [];
            };

            const [
                products, orders, transactions, treasuryAccounts, treasuryTransactions, suppliers, supplyOrders, reviews, abandonedCarts, 
                activityLogs, employees, discountCodes, collectionsList, customPages, 
                paymentMethods, customers, globalOptions, shippingIntegrations, partners, partnerTransactions, chatMessages,
                warehouses, inventoryAudits, stockTransfers, orderReturns, purchaseReturns, posSales, cashHolders, cashHandovers,
                whatsappTemplates, callScripts,
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
                    products, suppliers, supplyOrders, reviews, abandonedCarts, activityLogs, employees, discountCodes,
                    collections: collectionsList, customPages, paymentMethods, globalOptions, shippingIntegrations,
                    partners, partnerTransactions,
                    warehouses, inventoryAudits, stockTransfers, orderReturns, purchaseReturns, posSales,
                    cashHolders: (cashHolders || []).map((ch: any) => ({
                        ...ch,
                        userId: ch.userId || ch.user_id || ch.id || '',
                        userName: ch.userName || ch.user_name || '',
                        currentBalance: Number(ch.currentBalance ?? ch.current_balance ?? 0),
                        lastUpdated: ch.lastUpdated || ch.last_updated || new Date().toISOString()
                    })),
                    cashHandovers: (cashHandovers || []).map((ch: any) => ({
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
                    whatsappTemplates, callScripts
                },
                orders: (orders || []).map((o: any) => {
                    const localOrder = local?.orders?.find((lo: any) => lo.id === o.id);
                    if (localOrder) {
                        return {
                            ...o,
                            advancePayment: o.advancePayment ?? localOrder.advancePayment,
                            advancePaymentPartnerId: o.advancePaymentPartnerId ?? localOrder.advancePaymentPartnerId,
                            advancePaymentTreasuryId: o.advancePaymentTreasuryId ?? localOrder.advancePaymentTreasuryId,
                            advancePaymentEmployeeId: o.advancePaymentEmployeeId ?? (localOrder as any).advancePaymentEmployeeId,
                            advancePaymentRecipientPhone: o.advancePaymentRecipientPhone ?? localOrder.advancePaymentRecipientPhone,
                            advancePaymentSenderDetails: o.advancePaymentSenderDetails ?? localOrder.advancePaymentSenderDetails,
                        };
                    }
                    return o;
                }),
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
                customers
            };

            // SAFEGUARD: If Supabase returns nothing but we have local data, 
            // it means we probably haven't synced UP yet. 
            // Only perform this fallback if we ARE NOT forcing a pull from remote.
            const hasCloudData = (products && products.length > 0) || (orders && orders.length > 0) || (customers && customers.length > 0);
            if (!hasCloudData && !forceRemote && local && (local.orders?.length > 0 || local.settings?.products?.length > 0)) {
                console.log('[SUPABASE] Cloud empty but local has data. Using local to prevent wipe.');
                return local;
            }

            await saveLocal(storeId, fullData);
            return fullData;
        } catch (e) {
            console.error('Supabase fetch failed, falling back to local', e);
            return local;
        }
    }

    try {
        const storeSnap = await WITH_TIMEOUT(getDoc(doc(firebaseDb, 'stores_data', storeId))).catch(err => {
            handleFirestoreError(err, OperationType.GET, `stores_data/${storeId}`);
            throw err;
        });

        const fetchCollection = async <T>(collectionName: string, localItems: T[]): Promise<T[]> => {
            try {
                let snap = await getDocs(query(collection(firebaseDb, collectionName), where('storeId', '==', storeId)));
                let items = snap.docs.map(doc => ({ 
                    id: doc.id.startsWith(storeId + '_') ? doc.id.substring(storeId.length + 1) : doc.id, 
                    ...doc.data() 
                } as any));
                if (items.length === 0) {
                    const snap_snake = await getDocs(query(collection(firebaseDb, collectionName), where('store_id', '==', storeId)));
                    items = snap_snake.docs.map(doc => ({ 
                        id: doc.id.startsWith(storeId + '_') ? doc.id.substring(storeId.length + 1) : doc.id, 
                        ...doc.data() 
                    } as any));
                }
                
                // If forceRemote is true, we trust the cloud even if it's empty
                // unless it feels like an accidental wipe (safeguard)
                let finalItems = items;
                if (items.length === 0 && !forceRemote && localItems.length > 0) {
                    finalItems = localItems;
                }
                
                // Cache loaded results hash
                LAST_SYNCED_HASHES[`${storeId}_${collectionName}`] = getCollectionHash(finalItems);
                
                return finalItems;
            } catch (err) {
                return localItems;
            }
        };

        const [
            products, orders, transactions, treasuryAccounts, treasuryTransactions, suppliers, supplyOrders, reviews, abandonedCarts, 
            activityLogs, employees, discountCodes, collectionsList, customPages, 
            paymentMethods, customers, globalOptions, shippingIntegrations,
            partners, partnerTransactions, warehouses, inventoryAudits, stockTransfers, orderReturns, purchaseReturns, posSales, cashHolders, cashHandovers,
            whatsappTemplates, callScripts
        ] = await Promise.all([
            fetchCollection<Product>('products', local?.settings?.products || []),
            fetchCollection<Order>('orders', local?.orders || []),
            fetchCollection<Transaction>('transactions', local?.wallet?.transactions || []),
            fetchCollection<TreasuryAccount>('treasury_accounts', local?.treasury?.accounts || []),
            fetchCollection<TreasuryTransaction>('treasury_transactions', local?.treasury?.transactions || []),
            fetchCollection<Supplier>('suppliers', local?.settings?.suppliers || []),
            fetchCollection<SupplyOrder>('supply_orders', local?.settings?.supplyOrders || []),
            fetchCollection<Review>('reviews', local?.settings?.reviews || []),
            fetchCollection<AbandonedCart>('abandoned_carts', local?.settings?.abandonedCarts || []),
            fetchCollection<ActivityLog>('activity_logs', local?.settings?.activityLogs || []),
            fetchCollection<Employee>('employees', local?.settings?.employees || []),
            fetchCollection<DiscountCode>('discount_codes', local?.settings?.discountCodes || []),
            fetchCollection<Collection>('collections', local?.settings?.collections || []),
            fetchCollection<CustomPage>('custom_pages', local?.settings?.customPages || []),
            fetchCollection<PaymentMethod>('payment_methods', local?.settings?.paymentMethods || []),
            fetchCollection<CustomerProfile>('customers', local?.customers || []),
            fetchCollection<GlobalOption>('global_options', local?.settings?.globalOptions || []),
            fetchCollection<ShippingCarrierIntegration>('shipping_integrations', local?.settings?.shippingIntegrations || []),
            fetchCollection<Partner>('partners', local?.settings?.partners || []),
            fetchCollection<PartnerTransaction>('partner_transactions', local?.settings?.partnerTransactions || []),
            fetchCollection<Warehouse>('warehouses', local?.settings?.warehouses || []),
            fetchCollection<InventoryAuditSession>('inventory_audits', local?.settings?.inventoryAudits || []),
            fetchCollection<StockTransfer>('stock_transfers', local?.settings?.stockTransfers || []),
            fetchCollection<OrderReturn>('order_returns', local?.settings?.orderReturns || []),
            fetchCollection<PurchaseReturn>('purchase_returns', local?.settings?.purchaseReturns || []),
            fetchCollection<POSSale>('pos_sales', local?.settings?.posSales || []),
            fetchCollection<CashHolder>('cash_holders', local?.settings?.cashHolders || []),
            fetchCollection<CashHandover>('cash_handovers', local?.settings?.cashHandovers || []),
            fetchCollection<WhatsAppTemplate>('whatsapp_templates', local?.settings?.whatsappTemplates || []),
            fetchCollection<CallScript>('call_scripts', local?.settings?.callScripts || [])
        ]);

        const storeSnapData = storeSnap.exists() ? storeSnap.data() : {};
        const storeSettings = storeSnapData.settings || {};
        const storeName = storeSnapData.name || '';

        let finalProducts = products;
        if (finalProducts.length === 0) {
            // Priority: Cloud Relational -> Cloud Legacy -> Local Cache -> Initial
            finalProducts = storeSettings.products || local?.settings?.products || INITIAL_SETTINGS.products || [];
        }

        let finalCollections = collectionsList;
        if (finalCollections.length === 0) {
            finalCollections = storeSettings.collections || local?.settings?.collections || [];
        }

        let finalReviews = reviews;
        if (finalReviews.length === 0) {
            finalReviews = storeSettings.reviews || local?.settings?.reviews || [];
        }

        const walletSettingsObj = storeSettings.wallet_settings;
        const withdrawRequestsArr = storeSettings.withdraw_requests || [];
        const supplyBalanceNum = storeSettings.supply_balance || 0;
        const mainBalanceNum = storeSettings.wallet_balance || 0;

        const customization = {
            ...(INITIAL_SETTINGS.customization || {}),
            ...(storeSettings.customization || {})
        };
        // Ensure pageSections exists
        if (!customization.pageSections || customization.pageSections.length === 0) {
            customization.pageSections = INITIAL_SETTINGS.customization.pageSections;
        }

        const fullData: StoreData = {
            settings: {
                ...INITIAL_SETTINGS,
                ...storeSettings,
                customization,
                products: finalProducts,
                suppliers: suppliers,
                supplyOrders: supplyOrders,
                reviews: finalReviews,
                abandonedCarts: abandonedCarts,
                activityLogs: activityLogs,
                employees: employees.length > 0 ? employees : (storeSettings.employees || []),
                discountCodes: discountCodes,
                collections: finalCollections,
                customPages: customPages,
                paymentMethods: paymentMethods,
                globalOptions: globalOptions,
                shippingIntegrations: shippingIntegrations,
                partners: partners,
                partnerTransactions: partnerTransactions,
                warehouses: warehouses,
                inventoryAudits: inventoryAudits,
                stockTransfers: stockTransfers,
                orderReturns: orderReturns,
                purchaseReturns: purchaseReturns,
                posSales: posSales,
                cashHolders: (cashHolders || []).map((ch: any) => ({
                    ...ch,
                    userId: ch.userId || ch.id || '',
                    userName: ch.userName || ch.user_name || '',
                    currentBalance: Number(ch.currentBalance ?? ch.current_balance ?? 0),
                    lastUpdated: ch.lastUpdated || ch.last_updated || new Date().toISOString()
                })),
                cashHandovers: cashHandovers,
                whatsappTemplates: whatsappTemplates,
                callScripts: callScripts
            },
            orders: orders,
            wallet: { 
                balance: mainBalanceNum,
                supplyBalance: supplyBalanceNum,
                transactions: transactions,
                settings: walletSettingsObj,
                withdrawRequests: withdrawRequestsArr
            },
            treasury: {
                accounts: treasuryAccounts,
                transactions: treasuryTransactions
            },
            cart: [],
            customers: customers
        };

        if (typeof window !== 'undefined') {
            const localUrl = localStorage.getItem('custom_cloud_url');
            const localKey = localStorage.getItem('custom_cloud_anon_key');
            
            if (fullData.settings.supabaseUrl && fullData.settings.supabaseAnonKey) {
                if (localUrl !== fullData.settings.supabaseUrl || localKey !== fullData.settings.supabaseAnonKey) {
                    console.log('[SUPABASE] Detected global database connection in settings. Activating for this device...');
                    localStorage.setItem('custom_cloud_url', fullData.settings.supabaseUrl);
                    localStorage.setItem('custom_cloud_anon_key', fullData.settings.supabaseAnonKey);
                    // Re-fetch now that localStorage has the custom connection
                    return getStoreData(storeId, forceRemote);
                }
            } else if (!fullData.settings.supabaseUrl && localUrl) {
                console.log('[SUPABASE] Detected owner disconnected global SUPABASE connection. Reverting to Firebase...');
                localStorage.removeItem('custom_cloud_url');
                localStorage.removeItem('custom_cloud_anon_key');
            }
        }

        // Cache fetched data to local
        await saveLocal(storeId, fullData);
        return fullData;
    } catch (err: any) {
        // Fallback to local if fetch fails
        return local;
    }
};

export const saveStoreData = async (store: Store, data: StoreData): Promise<{ success: boolean, error?: string }> => {
    await saveLocal(store.id, data);

    // Destructure items to sync relationally
    const { 
        products = [], suppliers = [], supplyOrders = [], reviews = [], abandonedCarts = [], activityLogs = [],
        employees = [], discountCodes = [], collections = [], customPages = [], paymentMethods = [],
        globalOptions = [], shippingIntegrations = [], partners = [], partnerTransactions = [],
        warehouses = [], inventoryAudits = [], stockTransfers = [], orderReturns = [], purchaseReturns = [],
        posSales = [], cashHolders = [], cashHandovers = [], whatsappTemplates = [], callScripts = [],
        ...cleanSettings 
    } = data.settings;
    
    const { orders = [], wallet = { balance: 0, transactions: [] }, treasury = { accounts: [], transactions: [] }, customers = [] } = data;

    // SAFEGUARD: Keep products/collections in main document if they are few (Hybrid redundancy)
    // This ensures storefront always works even if sub-collection fetch fails
    const redundantSettings: any = {};
    if (products.length < 150) redundantSettings.products = products;
    if (collections.length < 50) redundantSettings.collections = collections;
    if (customPages.length < 50) redundantSettings.customPages = customPages;

    const cleanSettingsFinal = cleanUndefined({
        ...cleanSettings,
        ...redundantSettings,
        wallet_settings: wallet.settings || null,
        withdraw_requests: wallet.withdrawRequests || [],
        supply_balance: wallet.supplyBalance || 0,
        wallet_balance: wallet.balance || 0
    });

    // --- Custom Supabase Save Logic ---
    const supabase = getSupabaseClient();
    if (supabase) {
        try {
            // First: Ensure store record exists in stores_data (to satisfy FK constraints)
            await supabase.from('stores_data').upsert({
                id: store.id,
                name: store.name,
                settings: cleanSettingsFinal
            });

            // Synchronize Users to Supabase first to ensure employee and user relations are valid
            const localGlobal = await getLocal('global');
            const usersList = localGlobal?.users || [];
            
            // Map users to relational format
            const mappedUsersList = usersList.map((user: any) => ({
                phone: user.phone || '',
                full_name: user.fullName || '',
                password: user.password || '',
                email: user.email || null,
                is_admin: user.isAdmin || false,
                is_banned: user.isBanned || false,
                join_date: user.joinDate || null,
                stores: user.stores || [],
                sites: user.sites || []
            })).filter((u: any) => !!u.phone);

            if (mappedUsersList.length > 0) {
                const { error: usersError } = await supabase.from('users').upsert(mappedUsersList);
                if (usersError) {
                    console.warn('Upserting users during saveStoreData failed:', usersError);
                }
            }

            // Collect any employee phones about to be synced and ensure they are present in 'users' table
            const employeePhones = (data.settings.employees || [])
                .map((emp: any) => emp.phone)
                .filter(Boolean);
                
            const placeholderUsers = [];
            for (const phone of employeePhones) {
                const alreadySyncedCheck = mappedUsersList.some((u: any) => u.phone === phone);
                if (!alreadySyncedCheck) {
                    placeholderUsers.push({
                        phone,
                        full_name: `موظف ${phone}`,
                        password: 'no_password_stub',
                        email: null,
                        is_admin: false,
                        is_banned: false,
                        join_date: new Date().toISOString()
                    });
                }
            }
            if (placeholderUsers.length > 0) {
                const { error: stubError } = await supabase.from('users').upsert(placeholderUsers);
                if (stubError) {
                    console.warn('Upserting placeholderUsers failed:', stubError);
                }
            }

            const syncTable = async (table: string, items: any[], omitFields: string[] = []) => {
                // 1. Handle Deletions (Relational Sync)
                // We need to identify items currently in Supabase for this store that are NOT in the incoming 'items' list
                try {
                    const idField = table === 'employees' ? 'phone' : (table === 'cash_holders' ? 'user_id' : 'id');
                    const { data: cloudItems, error: fetchError } = await supabase
                        .from(table)
                        .select(idField)
                        .eq('store_id', store.id);

                    if (!fetchError && cloudItems) {
                        const localIds = new Set(items.map(item => String(item.phone || item.userId || item.user_id || item.id || '')));
                        const idsToDelete = cloudItems
                            .map((ci: any) => String(ci[idField]))
                            .filter(id => id && !localIds.has(id));

                        if (idsToDelete.length > 0) {
                            // Defensive check: only block if EVERYTHING is being deleted and there were MANY items
                            // This prevents accidental wipes if the app fails to load the local state correctly
                            const isTotalWipeOfLargeCollection = items.length === 0 && idsToDelete.length > 50;
                            if (!isTotalWipeOfLargeCollection) {
                                await supabase.from(table).delete().eq('store_id', store.id).in(idField, idsToDelete);
                            } else {
                                console.warn(`[SYNC] Safeguard triggered: Blocked total wipe of ${idsToDelete.length} items from ${table}`);
                            }
                        }
                    }
                } catch (deletionErr) {
                    console.error(`Failed to handle deletions for ${table}:`, deletionErr);
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

                    if (table === 'cash_holders') {
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
                            status: cleanItem.status || 'completed'
                        };
                    } else if (table === 'partners') {
                        mappedItem = {
                            ...mappedItem,
                            name: cleanItem.name || '',
                            phone: cleanItem.phone || '',
                            notes: cleanItem.notes || '',
                            balance: Number(cleanItem.balance ?? 0),
                            profit_ratio: Number(cleanItem.profitRatio ?? cleanItem.profit_ratio ?? 0),
                            profitratio: Number(cleanItem.profitRatio ?? cleanItem.profit_ratio ?? 0)
                        };
                    } else if (table === 'partner_transactions') {
                        mappedItem = {
                            ...mappedItem,
                            partner_id: cleanItem.partnerId || cleanItem.partner_id || '',
                            partnerid: cleanItem.partnerId || cleanItem.partner_id || '',
                            type: cleanItem.type || '',
                            amount: Number(cleanItem.amount ?? 0),
                            date: cleanItem.date || '',
                            note: cleanItem.note || ''
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
                            reference: cleanItem.reference || ''
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
                
                let currentItemsToUpsert = [...uniqueItems];
                let upsertSuccess = false;
                let attempts = 0;
                
                while (!upsertSuccess && attempts < 30) {
                    const { error } = await supabase.from(table).upsert(currentItemsToUpsert);
                    if (!error) {
                        upsertSuccess = true;
                        break;
                    }
                    
                    if (error.code === 'PGRST205' || error.code === 'PGRST116') {
                        console.warn(`Table ${table} not found in Supabase schema. Skipping sync.`);
                        return;
                    }
                    
                    if (error.code === 'PGRST204') {
                        console.warn(`Column missing in table ${table}: ${error.message}`);
                        // Return error specifically about columns so UI can show warning/button
                        (window as any).SUPABASE_SCHEMA_ERROR = {
                            table,
                            message: error.message,
                            code: error.code
                        };
                        
                        // Parse missing column name
                        const match = error.message.match(/Could not find the '([^']+)' column/i) || 
                                      error.message.match(/column "([^"]+)"/i) ||
                                      error.message.match(/column '([^']+)'/i);
                                      
                        if (match && match[1]) {
                            const missingCol = match[1];
                            console.warn(`[SYNC-SELF-HEAL] Stripping missing column '${missingCol}' from table '${table}' payload and retrying...`);
                            currentItemsToUpsert = currentItemsToUpsert.map(item => {
                                const copy = { ...item };
                                delete copy[missingCol];
                                return copy;
                            });
                            attempts++;
                            continue;
                        }
                    }
                    
                    throw error;
                }
            };

            // Parallel sync with individual error handling to ensure one table error (like missing column) 
            // doesn't block other tables (like employees) from syncing.
            const tablesToSync = [
                () => syncTable('products', data.settings.products, ['updatedAt']),
                () => syncTable('orders', data.orders),
                () => syncTable('transactions', data.wallet.transactions),
                () => syncTable('treasury_accounts', data.treasury?.accounts || []),
                () => syncTable('treasury_transactions', data.treasury?.transactions || []),
                () => syncTable('suppliers', data.settings.suppliers),
                () => syncTable('supply_orders', data.settings.supplyOrders),
                () => syncTable('reviews', data.settings.reviews),
                () => syncTable('abandoned_carts', data.settings.abandonedCarts),
                () => syncTable('activity_logs', data.settings.activityLogs || []),
                () => syncTable('employees', data.settings.employees, ['id', 'updatedAt']),
                () => syncTable('discount_codes', data.settings.discountCodes),
                () => syncTable('collections', data.settings.collections),
                () => syncTable('custom_pages', data.settings.customPages, ['isActive', 'updatedAt']),
                () => syncTable('payment_methods', data.settings.paymentMethods),
                () => syncTable('customers', data.customers),
                () => syncTable('global_options', data.settings.globalOptions),
                () => syncTable('shipping_integrations', data.settings.shippingIntegrations),
                () => syncTable('partners', data.settings.partners || []),
                () => syncTable('partner_transactions', data.settings.partnerTransactions || []),
                () => syncTable('warehouses', data.settings.warehouses || []),
                () => syncTable('inventory_audits', data.settings.inventoryAudits || []),
                () => syncTable('stock_transfers', data.settings.stockTransfers || []),
                () => syncTable('order_returns', data.settings.orderReturns || []),
                () => syncTable('purchase_returns', data.settings.purchaseReturns || []),
                () => syncTable('pos_sales', data.settings.posSales || []),
                () => syncTable('cash_holders', data.settings.cashHolders || []),
                () => syncTable('cash_handovers', data.settings.cashHandovers || []),
                () => syncTable('whatsapp_templates', data.settings.whatsappTemplates || []),
                () => syncTable('call_scripts', data.settings.callScripts || []),
                () => syncTable('chat_messages', [])
            ];

            const syncErrors: any[] = [];
            await Promise.all(tablesToSync.map(async (fn) => {
                try {
                    await fn();
                } catch (e: any) {
                    syncErrors.push(e);
                    console.error(`Table sync failed:`, e);
                }
            }));

            if (syncErrors.length > 0) {
                // If there are errors, check if any are schema related
                const isSchemaError = syncErrors.some(e => e.code === 'PGRST204');
                return { 
                    success: false, 
                    error: isSchemaError 
                        ? `كود الخطأ PGRST204: هناك أعمدة مفقودة في قاعدة البيانات (مثل minStockLevel). يرجى الضغط على زر "إصلاح الأعمدة المفقودة" في إعدادات المطورين.` 
                        : syncErrors[0].message 
                };
            }

            return { success: true };
        } catch (e: any) {
            console.error('Supabase save failed', e);
            return { success: false, error: e.message };
        }
    }

    try {
        await ensureStoreRecordExists(store.id, store.name);

        const syncCollection = async (collectionName: string, stateItems: any[], idField = 'id') => {
            try {
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
                const existingDocsMap = new Map(existingDbDocs.map(doc => [doc.id, doc]));

                const activeIds = new Set(stateItems.map(item => {
                    const baseId = String(item[idField] || item.phone || item.id);
                    // Ensure doc ID includes store.id to prevent cross-store overwriting
                    return baseId.startsWith(store.id) ? baseId : `${store.id}_${baseId}`;
                }));

                const conflictStrategy = (typeof window !== 'undefined' ? localStorage.getItem('syncConflictStrategy') : 'last_write_wins') || 'last_write_wins';

                const upsertPromises = stateItems.map(async (item) => {
                    const baseId = String(item[idField] || item.phone || item.id);
                    const docId = baseId.startsWith(store.id) ? baseId : `${store.id}_${baseId}`;
                    const docRef = doc(firebaseDb, collectionName, docId);
                    
                    const existingDoc = existingDocsMap.get(docId);
                    
                    let shouldUpdateCloud = true;
                    const nowISO = new Date().toISOString();
                    const itemWithTimestamp = { ...item };

                    if (existingDoc) {
                        // Check if fields other than ID and metadata have actually changed
                        const fieldsChanged = Object.keys(item).some(k => {
                            if (['id', 'storeId', 'store_id', 'updatedAt', 'updated_at', '_ref'].includes(k)) return false;
                            
                            const val1 = item[k];
                            const val2 = existingDoc[k];
                            if (typeof val1 === 'object' && val1 !== null && typeof val2 === 'object' && val2 !== null) {
                                return JSON.stringify(val1) !== JSON.stringify(val2);
                            }
                            return val1 !== val2;
                        });

                        if (!fieldsChanged) {
                            shouldUpdateCloud = false;
                        } else {
                            itemWithTimestamp.updatedAt = nowISO;
                        }

                        // Apply conflict resolution strategies
                        if (conflictStrategy === 'last_write_wins') {
                            if (existingDoc.updatedAt && itemWithTimestamp.updatedAt) {
                                const cloudTime = new Date(existingDoc.updatedAt).getTime();
                                const localTime = new Date(itemWithTimestamp.updatedAt).getTime();
                                if (cloudTime > localTime) {
                                    shouldUpdateCloud = false; 
                                }
                            }
                        } else if (conflictStrategy === 'cloud_wins') {
                            shouldUpdateCloud = false; // Never overwrite cloud with older/newer local if item exists
                        } else if (conflictStrategy === 'local_wins') {
                            shouldUpdateCloud = true; // Always overwrite cloud with local state
                        }
                    } else {
                        // Brand new record
                        if (!itemWithTimestamp.updatedAt) {
                            itemWithTimestamp.updatedAt = nowISO;
                        }
                    }

                    if (shouldUpdateCloud) {
                        const payload = cleanUndefined({ ...itemWithTimestamp, storeId: store.id, store_id: store.id });
                        await setDoc(docRef, payload, { merge: true }).catch(err => {
                            if (err?.code === 'resource-exhausted') {
                                throw new Error('QUOTA_EXCEEDED');
                            }
                            handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${docId}`);
                        });
                    }
                });

                const isMassDeletionRisk = (stateItems.length === 0 && existingDbDocs.length > 2 && ['products', 'orders', 'customers', 'users', 'transactions'].includes(collectionName));
                if (isMassDeletionRisk) {
                    console.warn(`[SYNC-SAFEGUARD] Skipped deletion for collection "${collectionName}" because incoming array is empty but Firestore has ${existingDbDocs.length} records. This prevents accidental database wipes during initialization.`);
                }

                const deletePromises = isMassDeletionRisk
                    ? []
                    : existingDbDocs
                        .filter(doc => !activeIds.has(doc.id))
                        .map(async (doc) => {
                            await deleteDoc(doc._ref).catch(err => {
                                if (err?.code === 'resource-exhausted') {
                                    throw new Error('QUOTA_EXCEEDED');
                                }
                                handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${doc.id}`);
                            });
                        });

                await Promise.all([...upsertPromises, ...deletePromises]);
                LAST_SYNCED_HASHES[hashKey] = currentHash;
            } catch (err: any) {
                if (err.message === 'QUOTA_EXCEEDED') throw err;
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
            syncCollection('call_scripts', callScripts)
        ]);

        const storeRef = doc(firebaseDb, 'stores_data', store.id);
        const storePayload = cleanUndefined({ settings: cleanSettingsFinal, name: store.name });
        await WITH_TIMEOUT(setDoc(storeRef, storePayload, { merge: true })).catch(err => {
            if (err?.code === 'resource-exhausted') {
                throw new Error('QUOTA_EXCEEDED');
            }
            handleFirestoreError(err, OperationType.WRITE, `stores_data/${store.id}`);
            throw err;
        });

        return { success: true };
    } catch (err: any) {
        if (err.message === 'QUOTA_EXCEEDED') {
            return { success: false, error: 'QUOTA_EXCEEDED' };
        }
        return { success: false, error: err.message };
    }
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
        const queryUsers = collection(firebaseDb, 'users');
        const snap = await getDocs(queryUsers).catch(err => {
            handleFirestoreError(err, OperationType.LIST, 'users');
            throw err;
        });

        const dbUsers: User[] = snap.docs.map(doc => {
            const data = doc.data();
            return {
                fullName: data.fullName || '',
                phone: doc.id,
                password: data.password || '',
                email: data.email || '',
                stores: data.stores || [],
                sites: data.sites || [],
                isAdmin: data.isAdmin || false,
                isBanned: data.isBanned || false,
                joinDate: data.joinDate || ''
            };
        });

        const localGlobal = await getLocal('global');
        const localUsers: User[] = localGlobal?.users || [];

        const mergedUsersMap = new Map<string, User>();
        localUsers.forEach(u => { if (u && u.phone) mergedUsersMap.set(u.phone, u); });
        dbUsers.forEach(u => { if (u && u.phone) mergedUsersMap.set(u.phone, u); });

        const finalUsers = Array.from(mergedUsersMap.values());

        const needsUpload = finalUsers.some(fu => !dbUsers.some(du => du.phone === fu.phone));
        if (needsUpload && finalUsers.length > 0) {
            const migrationPromises = finalUsers.map(async (u) => {
                const userRef = doc(firebaseDb, 'users', u.phone);
                const userPayload = cleanUndefined({
                    fullName: u.fullName,
                    password: u.password,
                    email: u.email,
                    stores: u.stores || [],
                    sites: u.sites || [],
                    isAdmin: u.isAdmin || false,
                    isBanned: u.isBanned || false,
                    joinDate: u.joinDate
                });
                await setDoc(userRef, userPayload, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${u.phone}`));
            });
            await Promise.all(migrationPromises);
        }

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
        const savePromises = data.users.map(async (u) => {
            if (!u.phone) return;
            const userRef = doc(firebaseDb, 'users', u.phone);
            const userPayload = cleanUndefined({
                fullName: u.fullName,
                password: u.password,
                email: u.email,
                stores: u.stores || [],
                sites: u.sites || [],
                isAdmin: u.isAdmin || false,
                isBanned: u.isBanned || false,
                joinDate: u.joinDate || ''
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
                    await saveStoreData(store, legacyData);
                }
            }
        }
        return { success: true, summary: "Completed" };
    } catch (err: any) {
        return { success: false, summary: "Failed", error: err.message };
    }
};
