import { db as firebaseDb } from './firebaseClient';
import { db as localDb } from '../src/lib/db';
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
    Treasury
} from '../types';
import { INITIAL_SETTINGS } from '../constants';

const LOCAL_STORAGE_PREFIX = 'wuilt_backup_';

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
        await getDocFromServer(doc(firebaseDb, 'stores_data', 'connection_test'));
        return true;
    } catch (error: any) {
        return false;
    }
};

export const getSupabaseRestrictedStatus = (): boolean => false;
export const setSupabaseRestricted = (restricted: boolean) => {};
export const isRestrictionError = (error: any): boolean => false;

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
    if (!forceRemote) {
        const local = await getLocal(storeId);
        if (local) {
            // Return local immediately
            return local;
        }
    }

    try {
        const storeSnap = await WITH_TIMEOUT(getDoc(doc(firebaseDb, 'stores_data', storeId))).catch(err => {
            handleFirestoreError(err, OperationType.GET, `stores_data/${storeId}`);
            throw err;
        });

        const fetchCollection = async <T>(collectionName: string): Promise<T[]> => {
            try {
                let snap = await getDocs(query(collection(firebaseDb, collectionName), where('storeId', '==', storeId)));
                let items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
                if (items.length === 0) {
                    const snap_snake = await getDocs(query(collection(firebaseDb, collectionName), where('store_id', '==', storeId)));
                    items = snap_snake.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
                }
                return items;
            } catch (err) {
                return [];
            }
        };

        const [
            products, orders, transactions, treasuryAccounts, treasuryTransactions, suppliers, supplyOrders, reviews, abandonedCarts, 
            activityLogs, employees, discountCodes, collectionsList, customPages, 
            paymentMethods, customers, globalOptions, shippingIntegrations
        ] = await Promise.all([
            fetchCollection<Product>('products'),
            fetchCollection<Order>('orders'),
            fetchCollection<Transaction>('transactions'),
            fetchCollection<TreasuryAccount>('treasury_accounts'),
            fetchCollection<TreasuryTransaction>('treasury_transactions'),
            fetchCollection<Supplier>('suppliers'),
            fetchCollection<SupplyOrder>('supply_orders'),
            fetchCollection<Review>('reviews'),
            fetchCollection<AbandonedCart>('abandoned_carts'),
            fetchCollection<ActivityLog>('activity_logs'),
            fetchCollection<Employee>('employees'),
            fetchCollection<DiscountCode>('discount_codes'),
            fetchCollection<Collection>('collections'),
            fetchCollection<CustomPage>('custom_pages'),
            fetchCollection<PaymentMethod>('payment_methods'),
            fetchCollection<CustomerProfile>('customers'),
            fetchCollection<GlobalOption>('global_options'),
            fetchCollection<ShippingCarrierIntegration>('shipping_integrations')
        ]);

        const storeSettings = storeSnap.exists() ? (storeSnap.data().settings || {}) : {};
        const storeName = storeSnap.exists() ? (storeSnap.data().name || '') : '';

        let finalProducts = products;
        if (finalProducts.length === 0 && INITIAL_SETTINGS.products.length > 0) {
            finalProducts = INITIAL_SETTINGS.products;
        }

        const walletSettingsObj = storeSettings.wallet_settings;
        const withdrawRequestsArr = storeSettings.withdraw_requests || [];
        const supplyBalanceNum = storeSettings.supply_balance || 0;
        const mainBalanceNum = storeSettings.wallet_balance || 0;

        const fullData: StoreData = {
            settings: {
                ...INITIAL_SETTINGS,
                ...storeSettings,
                products: finalProducts,
                suppliers: suppliers,
                supplyOrders: supplyOrders,
                reviews: reviews,
                abandonedCarts: abandonedCarts,
                activityLogs: activityLogs,
                employees: employees,
                discountCodes: discountCodes,
                collections: collectionsList,
                customPages: customPages,
                paymentMethods: paymentMethods,
                globalOptions: globalOptions,
                shippingIntegrations: shippingIntegrations
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

        await saveLocal(storeId, fullData);
        return fullData;
    } catch (err: any) {
        return getLocal(storeId);
    }
};

export const saveStoreData = async (store: Store, data: StoreData): Promise<{ success: boolean, error?: string }> => {
    await saveLocal(store.id, data);
    try {
        await ensureStoreRecordExists(store.id, store.name);

        const { 
            products = [], suppliers = [], supplyOrders = [], reviews = [], abandonedCarts = [], activityLogs = [],
            employees = [], discountCodes = [], collections = [], customPages = [], paymentMethods = [],
            globalOptions = [], shippingIntegrations = [],
            ...cleanSettings 
        } = data.settings;
        
        const { orders = [], wallet = { balance: 0, transactions: [] }, treasury = { accounts: [], transactions: [] }, customers = [] } = data;

        const cleanSettingsFinal = cleanUndefined({
            ...cleanSettings,
            wallet_settings: wallet.settings || null,
            withdraw_requests: wallet.withdrawRequests || [],
            supply_balance: wallet.supplyBalance || 0,
            wallet_balance: wallet.balance || 0
        });

        const syncCollection = async (collectionName: string, stateItems: any[], idField = 'id') => {
            try {
                let snap = await getDocs(query(collection(firebaseDb, collectionName), where('storeId', '==', store.id)));
                if (snap.empty) {
                    snap = await getDocs(query(collection(firebaseDb, collectionName), where('store_id', '==', store.id)));
                }
                
                const existingDbDocs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const stateIds = new Set(stateItems.map(item => String(item[idField] || `${store.id}_${item.phone || item.id}`)));

                const deletePromises = snap.docs
                    .filter(doc => !stateIds.has(doc.id))
                    .map(doc => deleteDoc(doc.ref).catch(err => handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${doc.id}`)));
                
                await Promise.all(deletePromises);

                const upsertPromises = stateItems.map(async (item) => {
                    const docId = String(item[idField] || `${store.id}_${item.phone || item.id}`);
                    const docRef = doc(firebaseDb, collectionName, docId);
                    const payload = cleanUndefined({ ...item, storeId: store.id, store_id: store.id });
                    await setDoc(docRef, payload, { merge: true }).catch(err => {
                        handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${docId}`);
                    });
                });

                await Promise.all(upsertPromises);
            } catch (err) {
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
            syncCollection('shipping_integrations', shippingIntegrations)
        ]);

        const storeRef = doc(firebaseDb, 'stores_data', store.id);
        const storePayload = cleanUndefined({ settings: cleanSettingsFinal, name: store.name });
        await WITH_TIMEOUT(setDoc(storeRef, storePayload, { merge: true })).catch(err => {
            handleFirestoreError(err, OperationType.WRITE, `stores_data/${store.id}`);
            throw err;
        });

        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
};

export const getGlobalData = async (forceRemote: boolean = false): Promise<{ users: User[], loyaltyData: any } | null> => {
    if (!forceRemote) {
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
                handleFirestoreError(err, OperationType.WRITE, `users/${u.phone}`);
            });
        });

        await Promise.all(savePromises);
        return { success: true };
    } catch (err: any) {
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
                default: return [];
            }
        }).flat();

        const clearPromises = collectionsToClear.map(async (colName) => {
            const q = query(collection(firebaseDb, colName), where('storeId', '==', storeId));
            const snap = await getDocs(q);
            const deleteDocs = snap.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deleteDocs);
        });

        await Promise.all(clearPromises);
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
