import { db as localDb } from '../src/lib/db';
import { cfFetch, subscribePolling } from './cloudflareClient';
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
    reconcileDualOrderSources,
    generateUniqueOrderId
} from '../utils/syncIntegrity';
import { normalizeMerchantLabel, isDummyMockSupplier, sanitizeSuppliersList } from '../utils/merchantProducts';

const LOCAL_STORAGE_PREFIX = 'wuilt_backup_';
const EXPLICIT_DELETED_STORAGE_KEY = 'explicit_deleted_cloud_ids_v1';

// --- Cloudflare D1 Verification ---
export const verifyCloudflareD1Connection = async (): Promise<{
    success: boolean;
    storesCount?: number;
    usersCount?: number;
    error?: string;
}> => {
    try {
        const res = await cfFetch<any>('/api/db/health');
        return {
            success: Boolean(res?.success),
            storesCount: res?.storesCount ?? 0,
            usersCount: res?.usersCount ?? 0
        };
    } catch (e: any) {
        return { success: false, error: e?.message || 'تعذر الاتصال بقاعدة بيانات Cloudflare D1' };
    }
};

// --- Hostinger MySQL Support (Optional external backup) ---
export const isHostingerActive = (): boolean => {
    return typeof window !== 'undefined' && window.localStorage?.getItem('custom_cloud_provider') === 'hostinger';
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

export enum OperationType {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
    LIST = 'list',
    GET = 'get',
    WRITE = 'write',
}

export interface DatabaseErrorInfo {
    error: string;
    operationType: OperationType;
    path: string | null;
    authInfo: {
        userId?: string | null;
    };
}

export function cleanUndefined<T>(obj: T): T {
    if (obj === null || obj === undefined) return null as any;
    if (Array.isArray(obj)) return obj.map(item => cleanUndefined(item)) as any;
    if (typeof obj === 'object') {
        const result: any = {};
        for (const key of Object.keys(obj)) {
            const val = (obj as any)[key];
            if (val !== undefined) result[key] = cleanUndefined(val);
        }
        return result;
    }
    return obj;
}

export const WITH_TIMEOUT = <T>(promise: Promise<T>, timeoutMs: number = 8000): Promise<T> => {
    let timer: ReturnType<typeof setTimeout>;
    return Promise.race([
        promise,
        new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
        })
    ]).finally(() => clearTimeout(timer));
};

// --- Explicit Deletion Tracking ---
const EXPLICIT_DELETED_IDS = new Set<string>();
try {
    if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(EXPLICIT_DELETED_STORAGE_KEY);
        if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) arr.forEach(id => EXPLICIT_DELETED_IDS.add(String(id)));
        }
    }
} catch (_) {}

const persistExplicitDeletions = () => {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const arr = Array.from(EXPLICIT_DELETED_IDS).slice(-2000);
            localStorage.setItem(EXPLICIT_DELETED_STORAGE_KEY, JSON.stringify(arr));
        }
    } catch (_) {}
};

export const isExplicitlyDeleted = (id: string, storeId?: string, collectionName: string = 'orders'): boolean => {
    if (!id) return false;
    const raw = String(id).trim();
    if (EXPLICIT_DELETED_IDS.has(raw)) return true;
    if (storeId) {
        const stripped = raw.startsWith(`${storeId}_`) ? raw.slice(storeId.length + 1) : raw;
        if (EXPLICIT_DELETED_IDS.has(stripped)) return true;
        if (EXPLICIT_DELETED_IDS.has(`${storeId}_${raw}`)) return true;
        if (EXPLICIT_DELETED_IDS.has(`${storeId}_${collectionName}_${raw}`)) return true;
        if (EXPLICIT_DELETED_IDS.has(`${storeId}_${collectionName}_${stripped}`)) return true;
        if (collectionName === 'orders' && EXPLICIT_DELETED_IDS.has(`${storeId}_orders_${raw}`)) return true;
    }
    return false;
};

const adjustBalanceForRemovedTransactions = (currentBalance: number, removedTxs: any[]): number => {
    let delta = 0;
    for (const tx of removedTxs) {
        if (!tx) continue;
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'إيداع' && tx.status === 'completed') {
            delta -= amt;
        } else if (tx.type === 'سحب' && tx.status !== 'cancelled') {
            delta += amt;
        }
    }
    return Math.round(((Number(currentBalance) || 0) + delta) * 100) / 100;
};

const recordExplicitDeletion = (key: string) => {
    if (!key) return;
    EXPLICIT_DELETED_IDS.add(key);
    persistExplicitDeletions();
};

// --- Local Dexie / IndexedDB Storage Helpers ---
export const getLocal = async (key: string): Promise<any> => {
    if (typeof window === 'undefined') return null;

    if (key === 'global') {
        try {
            const [users, globalSettings] = await Promise.all([
                localDb.users.toArray(),
                localDb.settings.get('global')
            ]);
            if (users.length > 0 || globalSettings) {
                return {
                    users,
                    loyaltyData: globalSettings?.data || {}
                };
            }
        } catch (e) {
            console.warn('Error reading global data from IndexedDB:', e);
        }
    } else if (key) {
        try {
            const [
                storeSettings,
                orders,
                products,
                customers,
                suppliers,
                supplyOrders,
                transactions,
                treasuryAccounts,
                treasuryTransactions,
                partners,
                partnerTransactions,
                warehouses,
                inventoryAudits,
                stockTransfers,
                orderReturns,
                purchaseReturns,
                posSales,
                cashHolders,
                cashHandovers,
                whatsappTemplates,
                callScripts,
                quotations
            ] = await Promise.all([
                localDb.settings.get(key),
                localDb.orders.where('store_id').equals(key).toArray(),
                localDb.products.where('store_id').equals(key).toArray(),
                localDb.customers.where('store_id').equals(key).toArray(),
                localDb.suppliers.where('store_id').equals(key).toArray(),
                localDb.supply_orders.where('store_id').equals(key).toArray(),
                localDb.transactions.where('store_id').equals(key).toArray(),
                localDb.treasury_accounts.where('store_id').equals(key).toArray(),
                localDb.treasury_transactions.where('store_id').equals(key).toArray(),
                localDb.partners.where('store_id').equals(key).toArray(),
                localDb.partner_transactions.where('store_id').equals(key).toArray(),
                localDb.warehouses.where('store_id').equals(key).toArray(),
                localDb.inventory_audits.where('store_id').equals(key).toArray(),
                localDb.stock_transfers.where('store_id').equals(key).toArray(),
                localDb.order_returns.where('store_id').equals(key).toArray(),
                localDb.purchase_returns.where('store_id').equals(key).toArray(),
                localDb.pos_sales.where('store_id').equals(key).toArray(),
                localDb.cash_holders.where('store_id').equals(key).toArray(),
                localDb.cash_handovers.where('store_id').equals(key).toArray(),
                localDb.whatsapp_templates.where('store_id').equals(key).toArray(),
                localDb.call_scripts.where('store_id').equals(key).toArray(),
                localDb.quotations.where('store_id').equals(key).toArray()
            ]);

            if (storeSettings || orders.length > 0 || products.length > 0) {
                const sData = storeSettings?.data || {};
                const fullData: any = {
                    settings: {
                        ...INITIAL_SETTINGS,
                        ...sData,
                        products: products.length > 0 ? products : (sData.products || []),
                        suppliers: sanitizeSuppliersList(suppliers.length > 0 ? suppliers : (sData.suppliers || [])),
                        supplyOrders: supplyOrders.length > 0 ? supplyOrders : (sData.supplyOrders || []),
                        partners: partners.length > 0 ? partners : (sData.partners || []),
                        partnerTransactions: partnerTransactions.length > 0 ? partnerTransactions : (sData.partnerTransactions || []),
                        warehouses: warehouses.length > 0 ? warehouses : (sData.warehouses || []),
                        inventoryAudits: inventoryAudits.length > 0 ? inventoryAudits : (sData.inventoryAudits || []),
                        stockTransfers: stockTransfers.length > 0 ? stockTransfers : (sData.stockTransfers || []),
                        orderReturns: orderReturns.length > 0 ? orderReturns : (sData.orderReturns || []),
                        purchaseReturns: purchaseReturns.length > 0 ? purchaseReturns : (sData.purchaseReturns || []),
                        posSales: posSales.length > 0 ? posSales : (sData.posSales || []),
                        cashHolders: cashHolders.length > 0 ? cashHolders : (sData.cashHolders || []),
                        cashHandovers: cashHandovers.length > 0 ? cashHandovers : (sData.cashHandovers || []),
                        whatsappTemplates: whatsappTemplates.length > 0 ? whatsappTemplates : (sData.whatsappTemplates || []),
                        callScripts: callScripts.length > 0 ? callScripts : (sData.callScripts || [])
                    },
                    orders: (orders || []).filter((o: any) => !isExplicitlyDeleted(o?.id, key, 'orders') && !isExplicitlyDeleted(o?.orderNumber, key, 'orders')),
                    wallet: (() => {
                        const rawTxs = Array.isArray(transactions) ? transactions : [];
                        const removedTxs = rawTxs.filter((t: any) => !t || isExplicitlyDeleted(t?.id, key, 'transactions'));
                        const filteredTxs = rawTxs.filter((t: any) => t && !isExplicitlyDeleted(t?.id, key, 'transactions'));
                        const baseBal = Number(sData.walletBalance || 0);
                        return {
                            balance: removedTxs.length > 0 ? adjustBalanceForRemovedTransactions(baseBal, removedTxs) : baseBal,
                            transactions: filteredTxs
                        };
                    })(),
                    treasury: { accounts: treasuryAccounts || [], transactions: treasuryTransactions || [] },
                    customers: customers || [],
                    quotations: quotations || []
                };
                return fullData;
            }
        } catch (e) {
            console.warn(`Error reading store ${key} from IndexedDB:`, e);
        }
    }

    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_PREFIX + key);
        if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
};

export const saveLocal = async (key: string, data: any) => {
    if (typeof window === 'undefined' || !key || !data) return;

    if (key === 'global') {
        try {
            if (Array.isArray(data.users) && data.users.length > 0) {
                const sanitized = data.users.map((u: any) => {
                    const copy = { ...u };
                    delete copy.password;
                    return copy;
                });
                await localDb.users.bulkPut(sanitized);
            }
            if (data.loyaltyData !== undefined) {
                await localDb.settings.put({ id: 'global', data: data.loyaltyData });
            }
        } catch (e) {
            console.warn('Error saving global data to IndexedDB:', e);
        }
        return;
    }

    try {
        const safeId = (x: any, prefix: string) => x?.id || x?.phone || `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
        const attachStoreId = (arr: any[], prefix: string) =>
            (Array.isArray(arr) ? arr : [])
                .filter(Boolean)
                .map(x => ({ ...x, id: safeId(x, prefix), store_id: key }));

        const rawSettings = { ...(data.settings || {}) };
        await localDb.transaction(
            'rw',
            [
                localDb.settings,
                localDb.orders,
                localDb.products,
                localDb.customers,
                localDb.suppliers,
                localDb.supply_orders,
                localDb.transactions,
                localDb.treasury_accounts,
                localDb.treasury_transactions,
                localDb.partners,
                localDb.partner_transactions,
                localDb.warehouses,
                localDb.inventory_audits,
                localDb.stock_transfers,
                localDb.order_returns,
                localDb.purchase_returns,
                localDb.pos_sales,
                localDb.cash_holders,
                localDb.cash_handovers,
                localDb.whatsapp_templates,
                localDb.call_scripts,
                localDb.quotations
            ],
            async () => {
                await localDb.settings.put({
                    id: key,
                    data: { ...rawSettings, walletBalance: data.wallet?.balance ?? 0 }
                });

                const syncTbl = async (tbl: any, rows: any[], prefix: string) => {
                    await tbl.where('store_id').equals(key).delete();
                    const prepared = attachStoreId(rows, prefix);
                    if (prepared.length > 0) await tbl.bulkPut(prepared);
                };

                await syncTbl(localDb.orders, data.orders || [], 'ord');
                await syncTbl(localDb.products, rawSettings.products || [], 'prod');
                await syncTbl(localDb.customers, data.customers || [], 'cust');
                await syncTbl(localDb.suppliers, rawSettings.suppliers || [], 'sup');
                await syncTbl(localDb.supply_orders, rawSettings.supplyOrders || [], 'so');
                await syncTbl(localDb.transactions, data.wallet?.transactions || [], 'tx');
                await syncTbl(localDb.treasury_accounts, data.treasury?.accounts || [], 'acc');
                await syncTbl(localDb.treasury_transactions, data.treasury?.transactions || [], 'ttx');
                await syncTbl(localDb.partners, rawSettings.partners || [], 'part');
                await syncTbl(localDb.partner_transactions, rawSettings.partnerTransactions || [], 'ptx');
                await syncTbl(localDb.warehouses, rawSettings.warehouses || [], 'wh');
                await syncTbl(localDb.inventory_audits, rawSettings.inventoryAudits || [], 'aud');
                await syncTbl(localDb.stock_transfers, rawSettings.stockTransfers || [], 'tr');
                await syncTbl(localDb.order_returns, rawSettings.orderReturns || [], 'or');
                await syncTbl(localDb.purchase_returns, rawSettings.purchaseReturns || [], 'pr');
                await syncTbl(localDb.pos_sales, rawSettings.posSales || [], 'pos');
                await syncTbl(localDb.cash_holders, rawSettings.cashHolders || [], 'ch');
                await syncTbl(localDb.cash_handovers, rawSettings.cashHandovers || [], 'cho');
                await syncTbl(localDb.whatsapp_templates, rawSettings.whatsappTemplates || [], 'wt');
                await syncTbl(localDb.call_scripts, rawSettings.callScripts || [], 'cs');
                await syncTbl(localDb.quotations, data.quotations || [], 'quo');
            }
        );
    } catch (e) {
        console.warn(`Error saving store ${key} to IndexedDB:`, e);
    }
};

export const deleteStoreItems = async (storeId: string, collectionName: string, itemIds: string[]): Promise<boolean> => {
    const cleanIds = Array.from(
        new Set(
            (itemIds || [])
                .map(id => String(id || '').trim())
                .filter(Boolean)
                .map(id => (id.startsWith(`${storeId}_`) ? id.substring(storeId.length + 1) : id))
        )
    );
    if (!storeId || !collectionName || cleanIds.length === 0) return true;

    try {
        for (const rawId of cleanIds) {
            recordExplicitDeletion(`${storeId}_${collectionName}_${rawId}`);
            recordExplicitDeletion(rawId);
        }

        // Send batch delete (supported by updated D1 API) and fall back cleanly if needed
        const batchRes = await cfFetch(`/api/db/stores/${encodeURIComponent(storeId)}/item`, {
            method: 'DELETE',
            body: JSON.stringify({ collectionName, itemIds: cleanIds, itemId: cleanIds[0] })
        }).catch(() => null);

        // If remote worker is on older single-item contract and batch had >1 item, also send per-item deletes
        if (cleanIds.length > 1 && (!batchRes || typeof (batchRes as any)?.deletedCount !== 'number')) {
            await Promise.all(
                cleanIds.slice(1).map(rawId =>
                    cfFetch(`/api/db/stores/${encodeURIComponent(storeId)}/item`, {
                        method: 'DELETE',
                        body: JSON.stringify({ collectionName, itemId: rawId })
                    }).catch(() => {})
                )
            );
        }

        const idSet = new Set(cleanIds);
        const matchesId = (val: any) => {
            if (!val) return false;
            const s = String(val).trim();
            const stripped = s.startsWith(`${storeId}_`) ? s.substring(storeId.length + 1) : s;
            return idSet.has(s) || idSet.has(stripped);
        };

        const local = await getLocal(storeId);
        if (local) {
            if (collectionName === 'orders' && Array.isArray(local.orders)) {
                local.orders = local.orders.filter((o: any) => !matchesId(o?.id) && !matchesId(o?.orderNumber));
            } else if (collectionName === 'transactions' && Array.isArray(local.wallet?.transactions)) {
                const removed = local.wallet.transactions.filter((t: any) => matchesId(t?.id));
                local.wallet.transactions = local.wallet.transactions.filter((t: any) => !matchesId(t?.id));
                if (removed.length > 0) {
                    local.wallet.balance = adjustBalanceForRemovedTransactions(Number(local.wallet.balance || 0), removed);
                }
            } else if (collectionName === 'treasury_transactions' && Array.isArray(local.treasury?.transactions)) {
                local.treasury.transactions = local.treasury.transactions.filter((t: any) => !matchesId(t?.id));
            } else if (collectionName === 'products' && Array.isArray(local.settings?.products)) {
                local.settings.products = local.settings.products.filter((p: any) => !matchesId(p?.id));
            } else if (collectionName === 'suppliers' && Array.isArray(local.settings?.suppliers)) {
                local.settings.suppliers = local.settings.suppliers.filter((s: any) => !matchesId(s?.id));
            } else if (collectionName === 'partners' && Array.isArray(local.settings?.partners)) {
                local.settings.partners = local.settings.partners.filter((p: any) => !matchesId(p?.id));
            }
            await saveLocal(storeId, local).catch(() => {});
        }
        return true;
    } catch (e) {
        console.error(`[deleteStoreItems] Error deleting ${cleanIds.length} items from ${collectionName}:`, e);
        return false;
    }
};

export const deleteStoreItem = async (storeId: string, collectionName: string, itemId: string): Promise<boolean> => {
    return deleteStoreItems(storeId, collectionName, [itemId]);
};

export const ensureStoreRecordExists = async (storeId: string, storeName: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const existing = await getStoreData(storeId, true);
        if (existing) return { success: true };
        await cfFetch(`/api/db/stores/${encodeURIComponent(storeId)}`, {
            method: 'PUT',
            body: JSON.stringify({
                storeName,
                storeData: {
                    name: storeName,
                    settings: { ...INITIAL_SETTINGS, storeName },
                    orders: [],
                    wallet: { balance: 0, transactions: [] },
                    treasury: { accounts: [], transactions: [] },
                    customers: [],
                    quotations: []
                }
            })
        });
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err?.message || 'Error ensuring store record' };
    }
};

export const getStoreData = async (storeId: string, forceRemote: boolean = false): Promise<StoreData | null> => {
    if (!storeId) return null;
    const local = await getLocal(storeId);

    // Optional Hostinger MySQL read
    if (isHostingerActive()) {
        try {
            const fetchTable = async (table: string) => {
                const res = await fetch(`/api/mysql/fetch?table=${table}&storeId=${encodeURIComponent(storeId)}`);
                const d = await res.json();
                return d.items || [];
            };
            const [
                products, orders, transactions, treasuryAccounts, treasuryTransactions,
                suppliers, supplyOrders, partners, partnerTransactions, merchantRequests, storeRowResult
            ] = await Promise.all([
                fetchTable('products'), fetchTable('orders'), fetchTable('transactions'),
                fetchTable('treasury_accounts'), fetchTable('treasury_transactions'), fetchTable('suppliers'),
                fetchTable('supply_orders'), fetchTable('partners'), fetchTable('partner_transactions'),
                fetchTable('merchant_requests'),
                fetch(`/api/mysql/fetch?table=stores_data&storeId=${encodeURIComponent(storeId)}`).then(r => r.json())
            ]);
            const storeRow = storeRowResult?.items?.[0];
            if (storeRow) {
                const storeSettings = storeRow.settings || {};
                const fullData: StoreData = {
                    settings: { ...INITIAL_SETTINGS, ...storeSettings, products, suppliers: sanitizeSuppliersList(suppliers), partners, partnerTransactions, supplyOrders },
                    orders: (orders || []).filter((o: any) => !isExplicitlyDeleted(o?.id, storeId, 'orders')),
                    wallet: (() => {
                        const rawTxs = Array.isArray(transactions) ? transactions : [];
                        const removedTxs = rawTxs.filter((t: any) => !t || isExplicitlyDeleted(t?.id, storeId, 'transactions'));
                        const filteredTxs = rawTxs.filter((t: any) => t && !isExplicitlyDeleted(t?.id, storeId, 'transactions'));
                        const baseBal = Number(storeSettings.wallet_balance || 0);
                        return {
                            balance: removedTxs.length > 0 ? adjustBalanceForRemovedTransactions(baseBal, removedTxs) : baseBal,
                            transactions: filteredTxs
                        };
                    })(),
                    treasury: { accounts: treasuryAccounts, transactions: treasuryTransactions },
                    customers: [],
                    merchantRequests: merchantRequests || []
                } as any;
                await saveLocal(storeId, fullData);
                return fullData;
            }
        } catch (e) {
            console.warn('[HOSTINGER-FETCH] Failed, falling back to Cloudflare D1:', e);
        }
    }

    // Primary Cloudflare D1 Fetch
    try {
        const res = await WITH_TIMEOUT(
            cfFetch<{ success: boolean; storeData: any }>(`/api/db/stores/${encodeURIComponent(storeId)}`),
            10000
        );
        const cloud = res?.storeData;
        if (cloud) {
            const cloudSettings = cloud.settings || {};
            const customization = {
                ...(INITIAL_SETTINGS.customization || {}),
                ...(cloudSettings.customization || {})
            };
            if (!customization.pageSections || customization.pageSections.length === 0) {
                customization.pageSections = INITIAL_SETTINGS.customization.pageSections;
            }

            // Reconcile local vs cloud orders cleanly without losing recent offline edits
            const cloudOrders = (cloud.orders || []).filter(
                (o: any) => o && !isExplicitlyDeleted(o.id, storeId) && !isExplicitlyDeleted(o.orderNumber, storeId)
            );
            const localOrders = (local?.orders || []).filter(
                (o: any) => !isExplicitlyDeleted(o?.id, storeId) && !isExplicitlyDeleted(o?.orderNumber, storeId)
            );
            const reconciledOrders = reconcileDualOrderSources(
                storeId,
                localOrders,
                cloudOrders,
                EXPLICIT_DELETED_IDS,
                true
            ).mergedOrders;

            const fullData: StoreData = {
                settings: {
                    ...INITIAL_SETTINGS,
                    ...cloudSettings,
                    customization,
                    storeName: cloudSettings.storeName || cloud.name || local?.settings?.storeName || 'المتجر',
                    suppliers: sanitizeSuppliersList(cloudSettings.suppliers || []).filter((s: any) => !isDummyMockSupplier(s)),
                    products: cloudSettings.products || [],
                    partners: cloudSettings.partners || [],
                    partnerTransactions: cloudSettings.partnerTransactions || [],
                    employees: cloudSettings.employees || []
                },
                orders: reconciledOrders,
                wallet: (() => {
                    const rawWallet = cloud.wallet || { balance: 0, transactions: [] };
                    const rawTxs = Array.isArray(rawWallet.transactions) ? rawWallet.transactions : [];
                    const removedTxs = rawTxs.filter((t: any) => !t || isExplicitlyDeleted(t?.id, storeId, 'transactions'));
                    const filteredTxs = rawTxs.filter((t: any) => t && !isExplicitlyDeleted(t?.id, storeId, 'transactions'));
                    const baseBal = Number(rawWallet.balance || 0);
                    return {
                        ...rawWallet,
                        balance: removedTxs.length > 0 ? adjustBalanceForRemovedTransactions(baseBal, removedTxs) : baseBal,
                        transactions: filteredTxs
                    };
                })(),
                treasury: cloud.treasury || { accounts: [], transactions: [] },
                cart: [],
                customers: cloud.customers || [],
                quotations: cloud.quotations || [],
                partnerRequests: cloud.partnerRequests || [],
                merchantRequests: cloud.merchantRequests || []
            } as any;

            const hasCloudData =
                (fullData.orders?.length || 0) > 0 ||
                (fullData.settings?.products?.length || 0) > 0 ||
                (fullData.settings?.suppliers?.length || 0) > 0;
            if (!hasCloudData && !forceRemote && local && ((local.orders?.length || 0) > 0 || (local.settings?.products?.length || 0) > 0)) {
                return local;
            }

            await saveLocal(storeId, fullData);
            return fullData;
        }
    } catch {
        // Silent fallback to local IndexedDB cache on transient network interruption
    }

    return local;
};

export const saveStoreData = async (store: Store, data: StoreData): Promise<{ success: boolean; version?: number; error?: string }> => {
    if (!store?.id || !data) return { success: false, error: 'Missing store or data' };
    const cleanData = cleanUndefined({
        ...data,
        orders: (data.orders || []).filter(
            (o: any) => o && !isExplicitlyDeleted(o.id, store.id, 'orders') && !isExplicitlyDeleted(o.orderNumber, store.id, 'orders')
        ),
        wallet: data.wallet
            ? {
                  ...data.wallet,
                  transactions: (data.wallet.transactions || []).filter(
                      (t: any) => t && !isExplicitlyDeleted(t.id, store.id, 'transactions')
                  )
              }
            : data.wallet
    });

    await saveLocal(store.id, cleanData);

    // Optional Hostinger MySQL sync
    if (isHostingerActive()) {
        try {
            await fetch('/api/mysql/migrate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ storeId: store.id, storeName: store.name, data: cleanData })
            });
        } catch (e: any) {
            console.warn('[HOSTINGER-SAVE] Failed:', e?.message);
        }
    }

    // Primary Cloudflare D1 Save
    try {
        const res = await cfFetch<{ success?: boolean; version?: number }>(`/api/db/stores/${encodeURIComponent(store.id)}`, {
            method: 'PUT',
            body: JSON.stringify({
                storeName: store.name,
                storeData: cleanData
            })
        });
        return { success: true, version: typeof res?.version === 'number' ? res.version : undefined };
    } catch (err: any) {
        console.error(`[CF-D1] Failed saving store ${store.id}:`, err);
        return { success: false, error: err?.message || 'فشل الحفظ في قاعدة بيانات Cloudflare D1' };
    }
};

export const getGlobalData = async (_forceRemote: boolean = false): Promise<{ users: User[]; loyaltyData: any } | null> => {
    const local = await getLocal('global');
    try {
        const res = await WITH_TIMEOUT(
            cfFetch<{ success: boolean; users: User[]; loyaltyData: any }>('/api/db/global'),
            8000
        );
        if (res?.success) {
            const payload = {
                users: Array.isArray(res.users) ? res.users : (local?.users || []),
                loyaltyData: res.loyaltyData || local?.loyaltyData || {}
            };
            await saveLocal('global', payload);
            return payload;
        }
    } catch {
        // Silent fallback to local IndexedDB cache on transient network interruption
    }
    return local || { users: [], loyaltyData: {} };
};

export const saveGlobalData = async (data: { users: User[]; loyaltyData: any }): Promise<{ success: boolean; error?: string }> => {
    await saveLocal('global', data);
    try {
        await cfFetch('/api/db/global', {
            method: 'PUT',
            body: JSON.stringify(cleanUndefined(data))
        });
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err?.message || 'فشل حفظ البيانات العامة في Cloudflare D1' };
    }
};

export const clearStoreData = async (storeId: string, targets: string[]): Promise<{ success: boolean; error?: string }> => {
    try {
        if (targets.includes('all') || targets.length > 0) {
            await cfFetch(`/api/db/stores/${encodeURIComponent(storeId)}/clear`, {
                method: 'POST',
                body: JSON.stringify({ targets })
            });
        }
        const local = await getLocal(storeId);
        if (local) {
            if (targets.includes('all') || targets.includes('orders')) local.orders = [];
            if (targets.includes('all') || targets.includes('products')) local.settings.products = [];
            if (targets.includes('all') || targets.includes('customers')) local.customers = [];
            await saveLocal(storeId, local);
        }
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err?.message };
    }
};

export const deleteStoreCompletely = async (storeId: string): Promise<{ success: boolean; error?: string }> => {
    try {
        await cfFetch(`/api/db/stores/${encodeURIComponent(storeId)}/delete`, { method: 'POST' });
        await localDb.settings.delete(storeId).catch(() => {});
        await localDb.orders.where('store_id').equals(storeId).delete().catch(() => {});
        await localDb.products.where('store_id').equals(storeId).delete().catch(() => {});
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err?.message };
    }
};

export const deleteUserCompletely = async (user: User): Promise<{ success: boolean; error?: string }> => {
    try {
        for (const s of user.stores || []) {
            if (s?.id) await deleteStoreCompletely(s.id);
        }
        await cfFetch(`/api/db/users/${encodeURIComponent(user.phone)}`, { method: 'DELETE' });
        await localDb.users.delete(user.phone).catch(() => {});
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err?.message };
    }
};

export const migrateAllLegacyDataToRelational = async (_users: User[]): Promise<{ success: boolean; summary: string; error?: string }> => {
    try {
        const res = await cfFetch<any>('/api/db/health');
        return {
            success: true,
            summary: `قاعدة بيانات Cloudflare D1 متصلة وتعمل بنجاح (${res.storesCount || 0} متجر، ${res.usersCount || 0} مستخدم).`
        };
    } catch (err: any) {
        return { success: false, summary: '', error: err?.message };
    }
};

export const getUserByPhone = async (phone: string): Promise<User | null> => {
    const cleanPhone = String(phone || '').trim();
    if (!cleanPhone) return null;
    try {
        const res = await cfFetch<{ success: boolean; user: User | null }>(`/api/db/users/${encodeURIComponent(cleanPhone)}`);
        if (res?.user) {
            await localDb.users.put(res.user).catch(() => {});
            return res.user;
        }
    } catch (_) {}
    try {
        const localUser = await localDb.users.get(cleanPhone);
        return localUser || null;
    } catch (_) {
        return null;
    }
};

export const createUserDoc = async (user: User): Promise<boolean> => {
    try {
        const sanitized = cleanUndefined({ ...user });
        await cfFetch('/api/db/users', {
            method: 'POST',
            body: JSON.stringify({ user: sanitized })
        });
        await localDb.users.put(sanitized).catch(() => {});
        return true;
    } catch (err) {
        console.error('[CF-D1] createUserDoc failed:', err);
        return false;
    }
};

export const saveUser = createUserDoc;

export const getAllUsers = async (): Promise<User[]> => {
    try {
        const res = await cfFetch<{ success: boolean; users: User[] }>('/api/db/users');
        const users = Array.isArray(res?.users) ? res.users : [];
        if (users.length > 0) {
            await localDb.users.bulkPut(users).catch(() => {});
        }
        return users;
    } catch {
        try {
            return await localDb.users.toArray();
        } catch {
            return [];
        }
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

export interface MerchantPortalRequest extends Omit<PartnerPortalRequest, 'partnerId' | 'partnerName' | 'isMerchantRequest'> {
    merchantId: string;
    merchantName: string;
    legacySource?: 'merchant_requests' | 'partner_requests';
}

export const calculateTransferFee = (amount: number, merchant?: any, settings?: any): number => {
    if (!amount || amount <= 0) return 0;
    const isDaily = merchant?.payoutFrequency === 'daily';
    const feeRate = isDaily
        ? (typeof merchant?.dailyTransferFee === 'number' ? merchant.dailyTransferFee : (settings?.dailyTransferFee ?? 1))
        : (typeof merchant?.weeklyTransferFee === 'number' ? merchant.weeklyTransferFee : (settings?.weeklyTransferFee ?? 25));
    const feeType = isDaily
        ? (merchant?.dailyTransferFeeType || settings?.dailyTransferFeeType || 'percentage')
        : (merchant?.weeklyTransferFeeType || settings?.weeklyTransferFeeType || 'fixed');

    if (feeRate > 0) {
        if (feeType === 'percentage') return Math.round(amount * (feeRate / 100) * 100) / 100;
        return Math.min(amount, Number(feeRate) || 0);
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
        if (!storeId) return { success: false, error: 'Missing storeId' };

        const nowIso = new Date().toISOString();
        const reqId = rawReq.id || `${rawReq.isMerchantRequest ? 'REQ-M-' : 'REQ-P-'}${generateUniqueOrderId('p')}`;

        const fullRequest: PartnerPortalRequest = {
            id: reqId,
            storeId,
            partnerId: rawReq.partnerId || '',
            partnerName: rawReq.partnerName || '',
            type: (rawReq.type as any) || 'withdrawal',
            typeArabic: rawReq.typeArabic || (rawReq.isMerchantRequest ? 'طلب موكل' : 'طلب شريك'),
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
            ...(rawReq.receiptImage ? { receiptImage: rawReq.receiptImage } : {}),
            ...(rawReq.refundMeta ? { refundMeta: rawReq.refundMeta } : {}),
            ...(rawReq.planRequestMeta ? { planRequestMeta: rawReq.planRequestMeta } : {})
        };

        try {
            const localKey = `partner_requests_${storeId}`;
            const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
            localStorage.setItem(localKey, JSON.stringify([fullRequest, ...existing.filter((r: any) => r.id !== reqId)]));
        } catch (_) {}

        await cfFetch(`/api/db/requests/${encodeURIComponent(storeId)}`, {
            method: 'POST',
            body: JSON.stringify({
                request: {
                    ...cleanUndefined(fullRequest),
                    merchantId: fullRequest.partnerId,
                    merchantName: fullRequest.partnerName
                }
            })
        });

        return { success: true };
    } catch (err: any) {
        console.error('[PARTNER-REQUEST] Error submitting request:', err);
        return { success: false, error: err?.message || 'فشل إرسال الطلب' };
    }
};

export const submitMerchantRequest = async (
    storeIdOrObj: string | (Partial<PartnerPortalRequest> & { storeId: string }),
    maybeReq?: Partial<PartnerPortalRequest>
): Promise<{ success: boolean; error?: string }> => {
    const isObjFirst = typeof storeIdOrObj === 'object' && storeIdOrObj !== null;
    if (isObjFirst) {
        return submitPartnerRequest({ ...storeIdOrObj, isMerchantRequest: true });
    }
    return submitPartnerRequest(storeIdOrObj, { ...(maybeReq || {}), isMerchantRequest: true });
};

export const getPartnerRequests = async (storeId: string): Promise<PartnerPortalRequest[]> => {
    const localKey = `partner_requests_${storeId}`;
    try {
        const res = await WITH_TIMEOUT(
            cfFetch<{ success: boolean; requests: any[] }>(`/api/db/requests/${encodeURIComponent(storeId)}`),
            8000
        );
        const list = (res?.requests || []).map((r: any) => ({
            ...r,
            partnerId: String(r.partnerId ?? r.merchantId ?? r.partner_id ?? r.merchant_id ?? ''),
            partnerName: String(r.partnerName ?? r.merchantName ?? r.partner_name ?? r.merchant_name ?? ''),
            createdAt: r.createdAt ?? r.created_at ?? r.date ?? new Date().toISOString()
        })) as PartnerPortalRequest[];
        try {
            localStorage.setItem(localKey, JSON.stringify(list));
        } catch (_) {}
        return list;
    } catch {
        try {
            return JSON.parse(localStorage.getItem(localKey) || '[]');
        } catch {
            return [];
        }
    }
};

export const getMerchantRequests = getPartnerRequests;

export const updatePartnerRequestStatus = async (
    requestId: string,
    storeId: string,
    status: 'approved' | 'rejected',
    meta?: { receiptImage?: string; transferReference?: string; approvedBy?: string; approvedAt?: string }
): Promise<boolean> => {
    try {
        const existing = await getPartnerRequests(storeId);
        const target = existing.find(r => r.id === requestId) || { id: requestId, storeId };
        const updated = {
            ...target,
            status,
            updatedAt: new Date().toISOString(),
            ...cleanUndefined(meta || {})
        };
        await cfFetch(`/api/db/requests/${encodeURIComponent(storeId)}/${encodeURIComponent(requestId)}`, {
            method: 'PUT',
            body: JSON.stringify({ request: updated })
        });
        return true;
    } catch (err) {
        console.error('[PARTNER-REQUEST] Status update failed:', err);
        return false;
    }
};

export const updateMerchantRequestStatus = updatePartnerRequestStatus;

export const deletePartnerRequestDoc = async (requestId: string, storeId: string): Promise<boolean> => {
    try {
        await cfFetch(`/api/db/requests/${encodeURIComponent(storeId)}/${encodeURIComponent(requestId)}`, {
            method: 'DELETE'
        });
        try {
            const localKey = `partner_requests_${storeId}`;
            const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
            localStorage.setItem(localKey, JSON.stringify(existing.filter((r: any) => r.id !== requestId)));
        } catch (_) {}
        return true;
    } catch (err) {
        console.error('[PARTNER-REQUEST] Delete failed:', err);
        return false;
    }
};

export const deleteMerchantRequestDoc = deletePartnerRequestDoc;

export const updatePartnerSettings = async (
    storeId: string,
    partners: any[],
    suppliers?: any[]
): Promise<{ success: boolean; error?: string }> => {
    try {
        const current = await getStoreData(storeId, true);
        const nextSettings = {
            ...(current?.settings || INITIAL_SETTINGS),
            partners,
            ...(suppliers ? { suppliers: sanitizeSuppliersList(suppliers) } : {})
        };
        await saveStoreData({ id: storeId, name: nextSettings.storeName || storeId } as Store, {
            ...(current || { orders: [], wallet: { balance: 0, transactions: [] }, treasury: { accounts: [], transactions: [] }, customers: [], quotations: [] }),
            settings: nextSettings
        } as StoreData);
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err?.message };
    }
};

export const resetMerchantAccountData = async (
    storeId: string,
    merchantIds: string[],
    merchantNames: string[] = []
): Promise<{
    success: boolean;
    remainingOrders: Order[];
    updatedSuppliers: Supplier[];
    updatedPartners: Partner[];
}> => {
    let remainingOrders: Order[] = [];
    let updatedSuppliers: Supplier[] = [];
    let updatedPartners: Partner[] = [];

    try {
        const idSet = new Set(merchantIds.map(id => String(id).trim().toLowerCase()).filter(Boolean));
        const nameSet = new Set(merchantNames.map(n => normalizeMerchantLabel(n)).filter(Boolean));
        const isMerchantEntity = (entity: any) => {
            if (!entity) return false;
            const eId = String(entity.id || entity.merchantId || entity.supplierId || '').trim().toLowerCase();
            const eName = normalizeMerchantLabel(entity.name || entity.merchantName || entity.supplierName || '');
            return (eId && idSet.has(eId)) || (eName && nameSet.has(eName));
        };

        const current = await getStoreData(storeId, true);
        if (current) {
            remainingOrders = (current.orders || []).filter(o => !isMerchantEntity(o));
            updatedSuppliers = (current.settings?.suppliers || []).map((s: any) =>
                isMerchantEntity(s) ? { ...s, balance: 0, transactions: [] } : s
            );
            updatedPartners = (current.settings?.partners || []).map((p: any) =>
                isMerchantEntity(p) ? { ...p, balance: 0 } : p
            );
            await saveStoreData({ id: storeId, name: current.settings?.storeName || storeId } as Store, {
                ...current,
                orders: remainingOrders,
                settings: {
                    ...current.settings,
                    suppliers: updatedSuppliers,
                    partners: updatedPartners
                }
            });
        }
        return { success: true, remainingOrders, updatedSuppliers, updatedPartners };
    } catch (e) {
        console.error('[resetMerchantAccountData] Error:', e);
        return { success: false, remainingOrders, updatedSuppliers, updatedPartners };
    }
};

// ============================================================================
// CLOUDFLARE D1 REALTIME POLLING & INCREMENTAL SYNC
// ============================================================================

export interface RealtimeSubscriptionOptions {
    tables?: string[];
    intervalMs?: number;
    onUpdate?: (payload: { table: string; eventType: string; newRecord?: any }) => void;
}

export const subscribeToStoreRealtimeOptimized = (
    storeId: string,
    options: RealtimeSubscriptionOptions = {}
): (() => void) => {
    if (!storeId) return () => {};
    let lastVersion: number | null = null;
    return subscribePolling(
        async () => {
            const res = await cfFetch<{ success: boolean; version: number; updatedAt: string | null }>(
                `/api/db/stores/${encodeURIComponent(storeId)}/meta`
            );
            return res;
        },
        (meta) => {
            if (meta?.success && typeof meta.version === 'number') {
                if (lastVersion !== null && meta.version !== lastVersion) {
                    options.onUpdate?.({ table: 'stores_data', eventType: 'UPDATE', newRecord: meta });
                }
                lastVersion = meta.version;
            }
        },
        options.intervalMs || 10000
    );
};

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
            if (fresh) onDataUpdated(fresh);
        } catch (err) {
            console.warn(`[THROTTLED-REFRESH] Error refreshing store ${storeId}:`, err);
        }
    };

    if (elapsed >= minIntervalMs) {
        if (state.timer) clearTimeout(state.timer);
        executeFetch();
    } else if (!state.timer) {
        state.timer = setTimeout(executeFetch, minIntervalMs - elapsed);
        refreshTimersMap.set(storeId, state);
    }
};

export const syncIncrementalStoreData = async (
    storeId: string,
    _lastSyncIsoTimestamp: string
): Promise<{
    updatedOrders: Order[];
    updatedPartnerRequests: PartnerPortalRequest[];
    timestamp: string;
}> => {
    const data = await getStoreData(storeId, true);
    const reqs = await getPartnerRequests(storeId);
    return {
        updatedOrders: data?.orders || [],
        updatedPartnerRequests: reqs,
        timestamp: new Date().toISOString()
    };
};

export const getAllStoresSettings = async (): Promise<Record<string, any>> => {
    const results: Record<string, any> = {};
    try {
        const res = await cfFetch<{ success: boolean; stores: Record<string, any> }>('/api/db/all-settings');
        if (res?.stores) {
            Object.entries(res.stores).forEach(([id, val]: [string, any]) => {
                if (val?.settings) results[id] = val.settings;
            });
        }
    } catch {
        // Silent fallback to Dexie cache
    }

    try {
        const allLocal = await localDb.settings.toArray();
        allLocal.forEach((item: any) => {
            if (item?.id && item.id !== 'global' && item?.data && !results[item.id]) {
                results[item.id] = item.data;
            }
        });
    } catch (_) {}

    return results;
};

export const getMerchantAllocatedProducts = async (merchantId: string, merchantName?: string): Promise<Product[]> => {
    const prodsMap = new Map<string, Product>();
    const mName = merchantName ? normalizeMerchantLabel(merchantName) : '';
    const mId = merchantId ? String(merchantId).trim().toLowerCase() : '';
    if (!mId && !mName) return [];

    if (mId) {
        try {
            const res = await cfFetch<{ success: boolean; products: Product[] }>(
                `/api/db/products/merchant/${encodeURIComponent(mId)}`
            );
            (res?.products || []).forEach(p => prodsMap.set(p.id, p));
        } catch (_) {}
    }

    const allSettings = await getAllStoresSettings();
    const candidateIds = new Set<string>(mId ? [mId] : []);
    Object.values(allSettings).forEach(st => {
        [...(st?.suppliers || []), ...(st?.partners || [])].forEach((e: any) => {
            const eName = normalizeMerchantLabel(e?.name || '');
            if (mName && eName && (eName === mName || eName.includes(mName) || mName.includes(eName))) {
                if (e?.id) candidateIds.add(String(e.id).trim().toLowerCase());
            }
        });
    });

    Object.values(allSettings).forEach(settings => {
        (Array.isArray(settings?.products) ? settings.products : []).forEach((p: any) => {
            if (prodsMap.has(p.id)) return;
            const pMId = String(p.merchantId || p.supplierId || '').trim().toLowerCase();
            const pMName = normalizeMerchantLabel(p.merchantName || p.supplierName || '');
            const hasInIds = Array.isArray(p.merchantIds) && p.merchantIds.some((id: any) => candidateIds.has(String(id).trim().toLowerCase()));
            const hasInAllocations = Array.isArray(p.merchantAllocations) && p.merchantAllocations.some((a: any) => {
                const aId = String(a.merchantId || '').trim().toLowerCase();
                const aName = normalizeMerchantLabel(a.merchantName || '');
                return (aId && (candidateIds.has(aId) || (mId && aId === mId))) || (mName && aName && (aName === mName || aName.includes(mName) || mName.includes(aName)));
            });
            if ((mId && pMId && (pMId === mId || candidateIds.has(pMId))) || (mName && pMName && (pMName === mName || pMName.includes(mName) || mName.includes(pMName))) || hasInIds || hasInAllocations) {
                prodsMap.set(p.id, p);
            }
        });
    });

    return Array.from(prodsMap.values());
};

export const pushLocalToHostinger = async (storeId: string, storeName: string, data: StoreData): Promise<{ success: boolean; error?: string }> => {
    try {
        const res = await fetch('/api/mysql/migrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                storeId,
                storeName,
                data: {
                    settings: data.settings,
                    orders: data.orders,
                    merchantRequests: data.merchantRequests || [],
                    wallet: data.wallet,
                    treasury: data.treasury
                }
            })
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};
