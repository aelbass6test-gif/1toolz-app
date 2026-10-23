import { db } from './firebaseClient';
import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';
import { 
  Order, 
  OrderStatus,
  StoreData, 
  MerchantManagerConfig, 
  MerchantSubscriptionConfig, 
  MerchantTransaction,
  DedicatedManagerPlanId,
  BillingCycleType
} from '../types';
import { 
  ORDER_QUOTA_POLICY, 
  toPiasters, 
  fromPiasters, 
  safeIsoDate 
} from '../utils/orderQuotaPolicy';
import { 
  DEDICATED_MANAGER_PLANS, 
  computeManagerPlanPricing,
  BILLING_CYCLES,
  isPlanCycleCurrentlyActive,
  buildOrderPlanSnapshot
} from '../utils/merchantSubscriptions';
import {
  generateUniqueOrderId,
  generateDisplayOrderNumber
} from '../utils/syncIntegrity';

// In-Memory Asynchronous Mutex per Store to serialize concurrent financial & inventory operations
class AsyncLock {
  private promises = new Map<string, Promise<void>>();

  async acquire(key: string): Promise<() => void> {
    while (this.promises.has(key)) {
      await this.promises.get(key);
    }
    let resolver: () => void;
    const promise = new Promise<void>(resolve => {
      resolver = resolve;
    });
    this.promises.set(key, promise);
    return () => {
      this.promises.delete(key);
      resolver!();
    };
  }
}

const mutex = new AsyncLock();

// Persistent + In-Memory Idempotency Registry to guard against replay attacks across server restarts
const IDEMPOTENCY_CACHE = new Map<string, { timestamp: number; result: any }>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function checkIdempotency(key?: string): any | null {
  if (!key) return null;
  const entry = IDEMPOTENCY_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > IDEMPOTENCY_TTL_MS) {
    IDEMPOTENCY_CACHE.delete(key);
    return null;
  }
  return entry.result;
}

export function saveIdempotency(key: string, result: any) {
  if (!key) return;
  IDEMPOTENCY_CACHE.set(key, { timestamp: Date.now(), result });
}

/**
 * Checks idempotency across both in-memory cache and Firestore persistent collection `idempotency_records`.
 * Guarantees that idempotency survives dev server restarts or cold starts.
 */
export async function getPersistentIdempotency(key?: string): Promise<any | null> {
  if (!key) return null;
  const inMem = checkIdempotency(key);
  if (inMem) return inMem;
  try {
    const snap = await getDoc(doc(db, 'idempotency_records', key));
    if (snap.exists()) {
      const data = snap.data();
      if (data && (!data.expiresAt || Date.now() < data.expiresAt)) {
        saveIdempotency(key, data.result);
        return data.result;
      }
    }
  } catch {
    // Graceful fallback for offline tests
  }
  return null;
}

/**
 * Persists idempotency record in both memory and Firestore document `idempotency_records/{key}`.
 */
export async function savePersistentIdempotency(key: string, result: any, tx?: any): Promise<void> {
  if (!key) return;
  saveIdempotency(key, result);
  try {
    const recordRef = doc(db, 'idempotency_records', key);
    const payload = {
      key,
      result,
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + IDEMPOTENCY_TTL_MS
    };
    if (tx && typeof tx.set === 'function') {
      tx.set(recordRef, payload, { merge: true });
    } else {
      await setDoc(recordRef, payload, { merge: true });
    }
  } catch {
    // Non-fatal if offline
  }
}

/**
 * Verifies that an authenticated actor or API key belongs to the target store.
 * Fixes Audit Issue #1: Cross-store access isolation on the server.
 */
export function verifyStoreAccessAuthorization(params: {
  targetStoreId: string;
  actorStoreId?: string;
  actorAllowedStoreIds?: string[];
  isSuperAdmin?: boolean;
}): void {
  const { targetStoreId, actorStoreId, actorAllowedStoreIds, isSuperAdmin } = params;
  if (isSuperAdmin) return;
  if (actorStoreId && actorStoreId !== targetStoreId) {
    throw new Error(`UNAUTHORIZED_CROSS_STORE_ACCESS: غير مصرح لهذا الحساب بالوصول إلى بيانات المتجر [${targetStoreId}]`);
  }
  if (Array.isArray(actorAllowedStoreIds) && !actorAllowedStoreIds.includes(targetStoreId)) {
    throw new Error(`UNAUTHORIZED_CROSS_STORE_ACCESS: غير مصرح لهذا الحساب بالوصول إلى بيانات المتجر [${targetStoreId}]`);
  }
}

export interface ConfirmOrderQuotaResult {
  success: boolean;
  order: Order;
  feeDeducted: number;
  quotaConsumed: boolean;
  cycleOrderNumber: number;
  newBalance: number;
  message: string;
  idempotentReplay?: boolean;
}

/**
 * Server-Authoritative Atomic Order Confirmation & Quota Deduction
 * 
 * Guarantees:
 * 1. Drafts never consume quota or fees.
 * 2. Only first confirmation event consumes quota & deducts fees.
 * 3. Idempotent: Re-calling with same order or key never duplicates charges (deterministic key merchantId + orderId).
 * 4. Concurrency-Safe: Serialized per store with AsyncLock.
 * 5. Under monthly_1000: Orders 1..50 = 0 EGP fee; Order 51+ = 20 EGP fee.
 * 6. Plan Changes & Expiration: Never re-prices past self-service orders, and never grants free quota on expired cycles.
 */
export async function confirmOrderWithQuotaAndFee(params: {
  storeId: string;
  orderId: string;
  confirmedBy?: string;
  idempotencyKey?: string;
  actorStoreId?: string;
  nowMs?: number;
  inMemoryStoreData?: StoreData; // Optional for offline/test environments
}): Promise<ConfirmOrderQuotaResult> {
  const {
    storeId,
    orderId,
    confirmedBy = 'System/Manager',
    idempotencyKey,
    actorStoreId,
    nowMs = Date.now(),
    inMemoryStoreData
  } = params;

  verifyStoreAccessAuthorization({ targetStoreId: storeId, actorStoreId });

  const effectiveIdempotencyKey = idempotencyKey || `confirm_order_${storeId}_${orderId}`;

  // 1. Check persistent idempotency first (survives dev server restart)
  const cached = await getPersistentIdempotency(effectiveIdempotencyKey);
  if (cached) {
    return { ...cached, idempotentReplay: true };
  }

  // 2. Acquire concurrency lock for this store
  const unlock = await mutex.acquire(`store_${storeId}`);

  try {
    // Re-check idempotency inside lock in case a concurrent duplicate call just finished
    const cachedInsideLock = await getPersistentIdempotency(effectiveIdempotencyKey);
    if (cachedInsideLock) {
      return { ...cachedInsideLock, idempotentReplay: true };
    }

    // If live Firestore DB is active and not an inMemory test, run true DB transaction
    if (!inMemoryStoreData && db) {
      return await runTransaction(db, async (tx) => {
        // Read idempotency doc
        const idempRef = doc(db, 'idempotency_records', effectiveIdempotencyKey);
        const idempSnap = await tx.get(idempRef);
        if (idempSnap.exists()) {
          const replayRes = idempSnap.data()?.result;
          if (replayRes) {
            saveIdempotency(effectiveIdempotencyKey, replayRes);
            return { ...replayRes, idempotentReplay: true };
          }
        }

        // Read store doc
        const storeRef = doc(db, 'stores_data', storeId);
        const storeSnap = await tx.get(storeRef);
        if (!storeSnap.exists()) {
          throw new Error(`المتجر غير موجود: [${storeId}]`);
        }
        const storeData = storeSnap.data() as StoreData;

        // Read order doc
        const orderDocId = orderId.startsWith(storeId) ? orderId : `${storeId}_${orderId}`;
        const orderRef = doc(db, 'orders', orderDocId);
        const orderSnap = await tx.get(orderRef);

        const currentOrders = Array.isArray(storeData.orders) ? storeData.orders : [];
        const orderIndex = currentOrders.findIndex(
          o => o.id === orderId || String(o.orderNumber) === orderId
        );

        if (orderIndex === -1 && !orderSnap.exists()) {
          throw new Error(`الطلب غير موجود: [${orderId}]`);
        }

        const targetOrder = orderIndex !== -1 ? currentOrders[orderIndex] : (orderSnap.data() as Order);

        // Idempotency check on order status
        if (targetOrder.quotaConsumedAt || targetOrder.status === 'قيد_التنفيذ' || (targetOrder.status as string) === 'مؤكد') {
          const suppliersList: any[] = Array.isArray(storeData.settings?.suppliers)
            ? storeData.settings.suppliers
            : Object.values(storeData.settings?.suppliers || {});
          const matchedSup = suppliersList.find(
            s => String(s?.id || '').toLowerCase() === String(targetOrder.merchantId || '').toLowerCase()
          );
          const replayResult: ConfirmOrderQuotaResult = {
            success: true,
            order: targetOrder,
            feeDeducted: Number(targetOrder.managerFeeAmount || 0),
            quotaConsumed: false,
            cycleOrderNumber: targetOrder.cycleOrderNumber || 1,
            newBalance: Number(matchedSup?.balance || 0),
            message: 'الطلب مؤكد مسبقاً، لم يتم تكرار الخصم أو استهلاك الكوتة (Idempotent)',
            idempotentReplay: true
          };
          saveIdempotency(effectiveIdempotencyKey, replayResult);
          return replayResult;
        }

        const suppliers: any[] = Array.isArray(storeData.settings?.suppliers)
          ? storeData.settings.suppliers
          : Object.values(storeData.settings?.suppliers || {});

        const targetMerchantId = String(targetOrder.merchantId || '').trim().toLowerCase();
        const targetMerchantName = String(targetOrder.merchantName || '').trim().toLowerCase();

        let matchedMerchant = suppliers.find(
          s => (targetMerchantId && String(s.id || '').toLowerCase() === targetMerchantId) ||
               (targetMerchantName && String(s.name || '').trim().toLowerCase() === targetMerchantName)
        );


        const nowIso = safeIsoDate(nowMs);
        let feeDeducted = 0;
        let quotaIncluded = false;
        let cycleOrderNumber = 1;
        let nextWalletBalance = Number(matchedMerchant?.balance || 0);

        const createdUnderSelfService = targetOrder.planModeAtCreation === 'self_service';

        if (matchedMerchant && !createdUnderSelfService) {
          const activeMgr: MerchantManagerConfig | undefined = matchedMerchant.managerPlan;
          const isCycleActive = isPlanCycleCurrentlyActive(activeMgr, nowMs);
          const effectivePlanId = targetOrder.planIdAtCreation || activeMgr?.planId;

          if (activeMgr && activeMgr.planId && activeMgr.planId !== 'none') {
            const cycleId = activeMgr.cycleId || targetOrder.planCycleId || `MGR-${effectivePlanId}-cycle`;

            const cycleOrders = currentOrders.filter(o => {
              if (o.status === 'ملغي' || o.id === targetOrder.id) return false;
              const matchesCycle = o.planCycleId === cycleId || (!o.planCycleId && o.planModeAtCreation === 'manager');
              return matchesCycle && Boolean(o.quotaConsumedAt || o.status === 'قيد_التنفيذ' || (o.status as string) === 'مؤكد');
            });

            cycleOrderNumber = cycleOrders.length + 1;

            if (effectivePlanId === 'monthly_1000' || effectivePlanId === 'monthly_700') {
              const includedQuota = activeMgr.includedOrdersQuota ?? 50;
              if (isCycleActive && cycleOrders.length < includedQuota) {
                feeDeducted = 0;
                quotaIncluded = true;
              } else {
                feeDeducted = activeMgr.extraOrderFee ?? 20;
                quotaIncluded = false;
              }
            } else if (effectivePlanId === 'per_order_20') {
              feeDeducted = Number(targetOrder.lockedManagerFee ?? activeMgr.orderFee ?? 20);
              quotaIncluded = false;
            } else if (effectivePlanId === 'custom_manager') {
              if (isCycleActive && activeMgr.customPrepaidQuota) {
                const quota = Number(activeMgr.customOrderQuota || activeMgr.customOrdersTarget || 0);
                if (cycleOrders.length < quota) {
                  feeDeducted = 0;
                  quotaIncluded = true;
                } else {
                  feeDeducted = Number(activeMgr.customOrderFee ?? 20);
                  quotaIncluded = false;
                }
              } else {
                feeDeducted = Number(targetOrder.lockedManagerFee ?? activeMgr.customOrderFee ?? 20);
                quotaIncluded = false;
              }
            }
          }

          if (feeDeducted > 0) {
            const currentBalPiasters = toPiasters(matchedMerchant.balance);
            const feePiasters = toPiasters(feeDeducted);
            const nextBalPiasters = currentBalPiasters - feePiasters;
            nextWalletBalance = fromPiasters(nextBalPiasters);

            const existingTxs: MerchantTransaction[] = Array.isArray(matchedMerchant.transactions)
              ? matchedMerchant.transactions
              : [];

            const feeTx: MerchantTransaction = {
              id: `TX-MGRFEE-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              merchantId: matchedMerchant.id,
              merchantName: matchedMerchant.name,
              date: nowIso,
              type: 'manager_order_fee',
              amount: -feeDeducted,
              balanceAfter: nextWalletBalance,
              referenceId: targetOrder.id,
              orderId: targetOrder.id,
              notes: quotaIncluded 
                ? `رسوم المدير المخصص: أوردر مشمول بالكوتة (0 ج.م)`
                : `خصم رسوم تشغيل المدير المخصص (${feeDeducted} ج.م) عن الأوردر #${targetOrder.orderNumber} (ترتيب بالدورة: ${cycleOrderNumber})`
            } as any;

            matchedMerchant.balance = nextWalletBalance;
            matchedMerchant.transactions = [feeTx, ...existingTxs];

            storeData.settings.suppliers = suppliers.map(s => s.id === matchedMerchant!.id ? matchedMerchant : s);
          }
        }

        const updatedOrder: Order = {
          ...targetOrder,
          status: 'قيد_التنفيذ' as OrderStatus,
          confirmedAt: nowIso,
          updatedAt: nowIso,
          quotaConsumedAt: nowIso,
          managerFeeDeducted: true,
          managerFeeAmount: feeDeducted,
          lockedManagerFee: feeDeducted,
          quotaIncludedOrder: quotaIncluded,
          cycleOrderNumber: cycleOrderNumber,
          notes: `${targetOrder.notes || ''} (تم التأكيد وحساب الكوتة بواسطة: ${confirmedBy})`.trim()
        };
        (updatedOrder as any).version = Number((targetOrder as any).version || 0) + 1;

        if (orderIndex !== -1) {
          currentOrders[orderIndex] = updatedOrder;
          storeData.orders = currentOrders;
        }

        // Writes within transaction
        tx.set(orderRef, { ...updatedOrder, storeId, store_id: storeId }, { merge: true });
        tx.set(storeRef, {
          orders: storeData.orders,
          settings: storeData.settings
        }, { merge: true });

        const txResult: ConfirmOrderQuotaResult = {
          success: true,
          order: updatedOrder,
          feeDeducted,
          quotaConsumed: true,
          cycleOrderNumber,
          newBalance: nextWalletBalance,
          message: feeDeducted === 0 && quotaIncluded
            ? `تم تأكيد الأوردر #${updatedOrder.orderNumber} بنجاح مجاناً ضمن كوتة الباقة (${cycleOrderNumber}/50)`
            : `تم تأكيد الأوردر #${updatedOrder.orderNumber} بنجاح وخصم رسوم المدير (${feeDeducted} ج.م) من محفظة الموكل`
        };

        tx.set(idempRef, {
          key: effectiveIdempotencyKey,
          result: txResult,
          timestamp: Date.now(),
          createdAt: nowIso,
          expiresAt: Date.now() + IDEMPOTENCY_TTL_MS
        }, { merge: true });

        saveIdempotency(effectiveIdempotencyKey, txResult);
        return txResult;
      });
    }

    // 3. Fallback for inMemoryStoreData (Offline tests)
    let storeData: StoreData;
    let storeRef: any = null;

    if (inMemoryStoreData) {
      storeData = inMemoryStoreData;
    } else {
      storeRef = doc(db, 'stores_data', storeId);
      const snap = await getDoc(storeRef);
      if (!snap.exists()) {
        throw new Error(`المتجر غير موجود: [${storeId}]`);
      }
      storeData = snap.data() as StoreData;
    }

    const currentOrders = Array.isArray(storeData.orders) ? storeData.orders : [];
    const orderIndex = currentOrders.findIndex(
      o => o.id === orderId || String(o.orderNumber) === orderId
    );

    if (orderIndex === -1) {
      throw new Error(`الطلب غير موجود: [${orderId}]`);
    }

    const targetOrder = currentOrders[orderIndex];

    // 4. Idempotency Check on Order Record
    // If order was already confirmed and quota was consumed, do NOT duplicate!
    if (targetOrder.quotaConsumedAt || targetOrder.status === 'قيد_التنفيذ' || (targetOrder.status as string) === 'مؤكد') {
      const suppliersList: any[] = Array.isArray(storeData.settings?.suppliers)
        ? storeData.settings.suppliers
        : Object.values(storeData.settings?.suppliers || {});
      const matchedSup = suppliersList.find(
        s => String(s?.id || '').toLowerCase() === String(targetOrder.merchantId || '').toLowerCase()
      );
      const replayResult: ConfirmOrderQuotaResult = {
        success: true,
        order: targetOrder,
        feeDeducted: Number(targetOrder.managerFeeAmount || 0),
        quotaConsumed: false,
        cycleOrderNumber: targetOrder.cycleOrderNumber || 1,
        newBalance: Number(matchedSup?.balance || 0),
        message: 'الطلب مؤكد مسبقاً، لم يتم تكرار الخصم أو استهلاك الكوتة (Idempotent)',
        idempotentReplay: true
      };
      saveIdempotency(effectiveIdempotencyKey, replayResult);
      return replayResult;
    }

    // 5. Match Merchant (Supplier or Partner)
    const suppliers: any[] = Array.isArray(storeData.settings?.suppliers)
      ? storeData.settings.suppliers
      : Object.values(storeData.settings?.suppliers || {});

    const targetMerchantId = String(targetOrder.merchantId || '').trim().toLowerCase();
    const targetMerchantName = String(targetOrder.merchantName || '').trim().toLowerCase();

    let matchedMerchant = suppliers.find(
      s => (targetMerchantId && String(s.id || '').toLowerCase() === targetMerchantId) ||
           (targetMerchantName && String(s.name || '').trim().toLowerCase() === targetMerchantName)
    );


    const nowIso = safeIsoDate(nowMs);
    let feeDeducted = 0;
    let quotaIncluded = false;
    let cycleOrderNumber = 1;
    let nextWalletBalance = Number(matchedMerchant?.balance || 0);

    // Audit Fix #7 & #11: If the order was stamped under `self_service` at creation,
    // never re-price it with a subsequent manager plan switch!
    const createdUnderSelfService = targetOrder.planModeAtCreation === 'self_service';

    if (matchedMerchant && !createdUnderSelfService) {
      const activeMgr: MerchantManagerConfig | undefined = matchedMerchant.managerPlan;
      const isCycleActive = isPlanCycleCurrentlyActive(activeMgr, nowMs);
      const effectivePlanId = targetOrder.planIdAtCreation || activeMgr?.planId;

      if (activeMgr && activeMgr.planId && activeMgr.planId !== 'none') {
        const cycleId = activeMgr.cycleId || targetOrder.planCycleId || `MGR-${effectivePlanId}-cycle`;

        // Count existing confirmed orders in this active cycle
        const cycleOrders = currentOrders.filter(o => {
          if (o.status === 'ملغي' || o.id === targetOrder.id) return false;
          const matchesCycle = o.planCycleId === cycleId || (!o.planCycleId && o.planModeAtCreation === 'manager');
          return matchesCycle && Boolean(o.quotaConsumedAt || o.status === 'قيد_التنفيذ' || (o.status as string) === 'مؤكد');
        });

        cycleOrderNumber = cycleOrders.length + 1;

        if (effectivePlanId === 'monthly_1000' || effectivePlanId === 'monthly_700') {
          const includedQuota = activeMgr.includedOrdersQuota ?? 50;
          // Audit Fix #6 & #11: Free quota ONLY applies if the paid cycle is currently active and not expired!
          if (isCycleActive && cycleOrders.length < includedQuota) {
            feeDeducted = 0;
            quotaIncluded = true;
          } else {
            feeDeducted = activeMgr.extraOrderFee ?? 20;
            quotaIncluded = false;
          }
        } else if (effectivePlanId === 'per_order_20') {
          feeDeducted = Number(targetOrder.lockedManagerFee ?? activeMgr.orderFee ?? 20);
          quotaIncluded = false;
        } else if (effectivePlanId === 'custom_manager') {
          if (isCycleActive && activeMgr.customPrepaidQuota) {
            const quota = Number(activeMgr.customOrderQuota || activeMgr.customOrdersTarget || 0);
            if (cycleOrders.length < quota) {
              feeDeducted = 0;
              quotaIncluded = true;
            } else {
              feeDeducted = Number(targetOrder.lockedManagerFee ?? activeMgr.customOrderFee ?? activeMgr.orderFee ?? 20);
              quotaIncluded = false;
            }
          } else {
            feeDeducted = Number(targetOrder.lockedManagerFee ?? activeMgr.customOrderFee ?? activeMgr.orderFee ?? 20);
            quotaIncluded = false;
          }
        }

        // Deterministic Ledger Key: merchantId + orderId + feeType
        const deterministicTxId = `MGR-FEE-${matchedMerchant.id}-${targetOrder.id}`;
        const existingTxs: MerchantTransaction[] = Array.isArray(matchedMerchant.transactions)
          ? matchedMerchant.transactions
          : [];
        const alreadyInLedger = existingTxs.some(
          tx => tx.id === deterministicTxId || (tx.type === 'manager_order_fee' && tx.referenceId === targetOrder.id)
        );

        // Deduct fee from wallet if fee > 0 and not already deducted
        if (feeDeducted > 0 && !alreadyInLedger) {
          const curPiasters = toPiasters(Number(matchedMerchant.balance || 0));
          const feePiasters = toPiasters(feeDeducted);
          const nextPiasters = curPiasters - feePiasters;
          nextWalletBalance = fromPiasters(nextPiasters);

          const feeTx: MerchantTransaction = {
            id: deterministicTxId,
            merchantId: matchedMerchant.id,
            merchantName: matchedMerchant.name,
            date: nowIso,
            type: 'manager_order_fee',
            amount: -feeDeducted,
            balanceAfter: nextWalletBalance,
            referenceId: targetOrder.id,
            orderId: targetOrder.id,
            notes: quotaIncluded 
              ? `رسوم المدير المخصص: أوردر مشمول بالكوتة (0 ج.م)`
              : `خصم رسوم تشغيل المدير المخصص (${feeDeducted} ج.م) عن الأوردر #${targetOrder.orderNumber} (ترتيب بالدورة: ${cycleOrderNumber})`
          } as any;

          matchedMerchant.balance = nextWalletBalance;
          matchedMerchant.transactions = [feeTx, ...existingTxs];

          storeData.settings.suppliers = suppliers.map(s => s.id === matchedMerchant!.id ? matchedMerchant : s);
        }
      }
    }

    // 6. Update target order state with version increment
    const updatedOrder: Order = {
      ...targetOrder,
      status: 'قيد_التنفيذ' as OrderStatus,
      confirmedAt: nowIso,
      updatedAt: nowIso,
      quotaConsumedAt: nowIso,
      managerFeeDeducted: true,
      managerFeeAmount: feeDeducted,
      lockedManagerFee: feeDeducted,
      quotaIncludedOrder: quotaIncluded,
      cycleOrderNumber: cycleOrderNumber,
      notes: `${targetOrder.notes || ''} (تم التأكيد وحساب الكوتة بواسطة: ${confirmedBy})`.trim()
    };
    (updatedOrder as any).version = Number((targetOrder as any).version || 0) + 1;

    currentOrders[orderIndex] = updatedOrder;
    storeData.orders = currentOrders;

    // 7. Persist to Firestore (both orders collection and stores_data) if live DB reference available
    if (storeRef) {
      const orderDocId = updatedOrder.id.startsWith(storeId) ? updatedOrder.id : `${storeId}_${updatedOrder.id}`;
      await setDoc(doc(db, 'orders', orderDocId), { ...updatedOrder, storeId, store_id: storeId }, { merge: true });
      await setDoc(storeRef, {
        orders: storeData.orders,
        settings: storeData.settings
      }, { merge: true });
    }

    const result: ConfirmOrderQuotaResult = {
      success: true,
      order: updatedOrder,
      feeDeducted,
      quotaConsumed: true,
      cycleOrderNumber,
      newBalance: nextWalletBalance,
      message: feeDeducted === 0 && quotaIncluded
        ? `تم تأكيد الأوردر #${updatedOrder.orderNumber} بنجاح مجاناً ضمن كوتة الباقة (${cycleOrderNumber}/50)`
        : `تم تأكيد الأوردر #${updatedOrder.orderNumber} بنجاح وخصم رسوم المدير (${feeDeducted} ج.م) من محفظة الموكل`
    };

    saveIdempotency(effectiveIdempotencyKey, result);
    return result;
  } finally {
    unlock();
  }
}

export interface StoreDataAdapter {
  getStoreData(storeId: string): Promise<StoreData | null>;
  saveStoreData(storeId: string, data: StoreData): Promise<boolean | any>;
}

/**
 * Atomic Server-Side Order Creation & Stock Reservation
 * Fixes Audit Issues #5, #7, #8, #9:
 * - Serializes concurrent order creations per store via AsyncLock so parallel API/UI calls never overwrite each other.
 * - Blocks Dedicated Account Managers or restricted merchants from unauthorized order creation.
 * - Validates & reserves stock atomically; rejects if two concurrent orders compete for the last item.
 * - Generates collision-free UUID order IDs.
 */
export async function createOrderAtomic(
  adapterOrParams: StoreDataAdapter | any,
  maybeParams?: any
): Promise<{
  success: boolean;
  code?: string;
  message?: string;
  order?: Order;
  alreadyExisted?: boolean;
  idempotentReplay?: boolean;
}> {
  const hasAdapter =
    adapterOrParams &&
    typeof adapterOrParams.getStoreData === 'function' &&
    typeof adapterOrParams.saveStoreData === 'function';
  const adapter: StoreDataAdapter | null = hasAdapter ? adapterOrParams : null;
  const params = hasAdapter ? maybeParams : adapterOrParams;

  const {
    storeId,
    actorStoreId,
    authorizedStoreIds,
    actorRole = 'api',
    orderInput,
    orderPayload,
    idempotencyKey,
    enforceStockAvailability = true,
    nowMs = Date.now(),
    inMemoryStoreData
  } = params || {};

  const effectiveOrderInput = orderInput || orderPayload || {};

  // Cross-store isolation check
  if (Array.isArray(authorizedStoreIds) && authorizedStoreIds.length > 0 && !authorizedStoreIds.includes(storeId)) {
    return {
      success: false,
      code: 'CrossStoreAccessDenied',
      message: `CROSS_STORE_ACCESS_DENIED: لا تملك صلاحية الوصول إلى المتجر [${storeId}]`
    };
  }
  if (actorStoreId && actorStoreId !== storeId) {
    return {
      success: false,
      code: 'CrossStoreAccessDenied',
      message: `CROSS_STORE_ACCESS_DENIED: لا تملك صلاحية الوصول إلى المتجر [${storeId}]`
    };
  }

  // Dedicated Account Manager creation restriction
  const normalizedRole = String(actorRole || '').toLowerCase();
  if (
    normalizedRole === 'account_manager' ||
    normalizedRole === 'dedicated_manager' ||
    normalizedRole === 'مدير_حساب' ||
    normalizedRole === 'مدير_مخصص'
  ) {
    return {
      success: false,
      code: 'DedicatedManagerOrderCreationForbidden',
      message: 'DEDICATED_MANAGER_ORDER_CREATION_FORBIDDEN: حساب المدير المخصص غير مخول بإنشاء طلبات مباشرة'
    };
  }

  if (idempotencyKey) {
    const cached = checkIdempotency(idempotencyKey);
    if (cached) return { ...cached, alreadyExisted: true, idempotentReplay: true };
  }

  const unlock = await mutex.acquire(`store_${storeId}`);
  try {
    if (idempotencyKey) {
      const cachedInside = checkIdempotency(idempotencyKey);
      if (cachedInside) return { ...cachedInside, alreadyExisted: true, idempotentReplay: true };
    }

    if (!adapter && !inMemoryStoreData && db) {
      // Database-level ACID Transaction across: Order, Store, Inventory Stock, and Idempotency Record
      return await runTransaction(db, async (tx) => {
        // 1. Transaction Read Phase: Persistent Idempotency Record
        if (idempotencyKey) {
          const idempRef = doc(db, 'idempotency_records', idempotencyKey);
          const idempSnap = await tx.get(idempRef);
          if (idempSnap.exists()) {
            const cachedResult = idempSnap.data()?.result;
            if (cachedResult) {
              saveIdempotency(idempotencyKey, cachedResult);
              return { ...cachedResult, alreadyExisted: true, idempotentReplay: true };
            }
          }
        }

        // 2. Transaction Read Phase: Store Document
        const storeRef = doc(db, 'stores_data', storeId);
        const storeSnap = await tx.get(storeRef);
        if (!storeSnap.exists()) {
          return { success: false, code: 'StoreNotFound', message: `المتجر غير موجود: [${storeId}]` };
        }
        const storeData = storeSnap.data() as StoreData;

        // 3. Transaction Read Phase: Check Order collision if ID specified
        const uniqueId = effectiveOrderInput.id || generateUniqueOrderId('ord');
        const orderDocId = uniqueId.startsWith(storeId) ? uniqueId : `${storeId}_${uniqueId}`;
        const orderRef = doc(db, 'orders', orderDocId);
        const orderSnap = await tx.get(orderRef);
        if (orderSnap.exists()) {
          const existingOrder = orderSnap.data() as Order;
          const replayRes = { success: true, order: existingOrder, alreadyExisted: true, idempotentReplay: true };
          if (idempotencyKey) {
            saveIdempotency(idempotencyKey, replayRes);
          }
          return replayRes;
        }

        const currentOrders = Array.isArray(storeData.orders) ? storeData.orders : [];
        const existingInArray = currentOrders.find(
          (o: any) =>
            (effectiveOrderInput.id && o.id === effectiveOrderInput.id) ||
            (idempotencyKey && o.idempotencyKey === idempotencyKey)
        );
        if (existingInArray) {
          const replayRes = { success: true, order: existingInArray, alreadyExisted: true, idempotentReplay: true };
          if (idempotencyKey) saveIdempotency(idempotencyKey, replayRes);
          return replayRes;
        }

        // 4. Validation: Dedicated Manager restriction
        const suppliers: any[] = Array.isArray(storeData.settings?.suppliers)
          ? storeData.settings.suppliers
          : Object.values(storeData.settings?.suppliers || {});

        let matchedMerchant: any = null;
        if (effectiveOrderInput.merchantId) {
          matchedMerchant = suppliers.find(s => s.id === effectiveOrderInput.merchantId);
        }

        if (normalizedRole === 'merchant' && matchedMerchant && isPlanCycleCurrentlyActive(matchedMerchant.managerPlan, nowMs)) {
          return {
            success: false,
            code: 'DedicatedManagerOrderCreationForbidden',
            message: 'MERCHANT_ORDER_CREATION_FORBIDDEN: الموكل المشترك في باقة المدير المخصص لا يمكنه إنشاء الأوردرات بنفسه؛ تتولى الإدارة إنشاءها نيابةً عنه.'
          };
        }

        // 5. Stock Validation & Reservation
        const products: any[] = Array.isArray((storeData.settings as any)?.products)
          ? (storeData.settings as any).products
          : [];
        const requestedItems = Array.isArray(effectiveOrderInput.items) ? effectiveOrderInput.items : [];
        const requestedQuantityByProduct = new Map<string, number>();
        for (const reqItem of requestedItems) {
          const pid = String(reqItem.productId || reqItem.id || '').trim();
          if (!pid) continue;
          const reqQty = Math.max(1, Number(reqItem.quantity || 1));
          requestedQuantityByProduct.set(pid, (requestedQuantityByProduct.get(pid) || 0) + reqQty);
        }

        if (enforceStockAvailability) {
          for (const [pid, reqQty] of requestedQuantityByProduct) {
            const prod = products.find(p => p.id === pid);
            if (prod) {
              const available = Number(prod.stockQuantity ?? prod.stock ?? prod.quantity ?? 0);
              if (reqQty > available) {
                return {
                  success: false,
                  code: 'InsufficientStock',
                  message: `INSUFFICIENT_STOCK: الكمية المطلوبة إجمالاً (${reqQty}) للمنتج [${prod.name || pid}] تتجاوز المخزون المتاح (${available})`
                };
              }
            }
          }
        }

        // Deduct each product's aggregated quantity atomically exactly once.
        const nowIso = safeIsoDate(nowMs);
        for (const [pid, reqQty] of requestedQuantityByProduct) {
          const prodIdx = products.findIndex(p => p.id === pid);
          if (prodIdx >= 0) {
            const prod = products[prodIdx];
            const available = Number(prod.stockQuantity ?? prod.stock ?? prod.quantity ?? 0);
            const nextStock = Math.max(0, available - reqQty);
            products[prodIdx] = {
              ...prod,
              stock: nextStock,
              stockQuantity: nextStock,
              quantity: nextStock,
              updatedAt: nowIso,
              version: Number(prod.version || 0) + 1
            };
          }
        }
        if (storeData.settings) {
          (storeData.settings as any).products = products;
        }

        const displayOrderNumber = effectiveOrderInput.orderNumber || generateDisplayOrderNumber('ORD');
        const planSnapshot = matchedMerchant ? buildOrderPlanSnapshot(matchedMerchant, nowMs) : {};

        const newOrder: Order = {
          ...effectiveOrderInput,
          ...planSnapshot,
          id: uniqueId,
          orderNumber: displayOrderNumber,
          customerName: effectiveOrderInput.customerName,
          customerPhone: effectiveOrderInput.customerPhone,
          customerAddress: effectiveOrderInput.customerAddress || (effectiveOrderInput as any).address || '',
          shippingCompany: effectiveOrderInput.shippingCompany || 'بوسطه',
          shippingArea: effectiveOrderInput.shippingArea || effectiveOrderInput.governorate || 'القاهرة',
          status: (effectiveOrderInput.status || 'جاري_المراجعة') as OrderStatus,
          paymentStatus: effectiveOrderInput.paymentStatus || 'بانتظار الدفع',
          preparationStatus: effectiveOrderInput.preparationStatus || 'بانتظار التجهيز',
          productName: effectiveOrderInput.productName || requestedItems[0]?.name || 'منتج',
          productPrice: Number(effectiveOrderInput.productPrice ?? effectiveOrderInput.totalPrice ?? 0),
          productCost: Number(effectiveOrderInput.productCost ?? 0),
          totalPrice: Number(effectiveOrderInput.totalPrice ?? (effectiveOrderInput as any).totalAmount ?? 0),
          shippingFee: Number(effectiveOrderInput.shippingFee ?? 0),
          weight: Number(effectiveOrderInput.weight ?? 1),
          discount: Number(effectiveOrderInput.discount ?? 0),
          date: effectiveOrderInput.date || nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
          stockDeducted: requestedItems.length > 0,
          items: requestedItems as any,
          version: 1,
          ...(idempotencyKey ? { idempotencyKey } : {})
        };

        storeData.orders = [newOrder, ...currentOrders.filter(o => o.id !== uniqueId)];

        // 6. Atomic Transaction Writes
        tx.set(orderRef, { ...newOrder, storeId, store_id: storeId }, { merge: true });
        tx.set(storeRef, {
          orders: storeData.orders,
          settings: storeData.settings
        }, { merge: true });

        const resultPayload = { success: true, order: newOrder, alreadyExisted: false, idempotentReplay: false };
        if (idempotencyKey) {
          tx.set(doc(db, 'idempotency_records', idempotencyKey), {
            key: idempotencyKey,
            result: resultPayload,
            timestamp: Date.now(),
            createdAt: nowIso,
            expiresAt: Date.now() + IDEMPOTENCY_TTL_MS
          }, { merge: true });
          saveIdempotency(idempotencyKey, resultPayload);
        }

        return resultPayload;
      });
    }

    let storeData: StoreData;
    let storeRef: any = null;

    if (adapter) {
      const loaded = await adapter.getStoreData(storeId);
      if (!loaded) {
        return { success: false, code: 'StoreNotFound', message: `المتجر غير موجود: [${storeId}]` };
      }
      storeData = loaded;
    } else if (inMemoryStoreData) {
      storeData = inMemoryStoreData;
    } else {
      storeRef = doc(db, 'stores_data', storeId);
      const snap = await getDoc(storeRef);
      if (!snap.exists()) {
        return { success: false, code: 'StoreNotFound', message: `المتجر غير موجود: [${storeId}]` };
      }
      storeData = snap.data() as StoreData;
    }

    const currentOrders = Array.isArray(storeData.orders) ? storeData.orders : [];

    // Check if an order with the same id or idempotencyKey already exists in storeData.orders
    const existingByIdOrKey = currentOrders.find(
      (o: any) =>
        (effectiveOrderInput.id && o.id === effectiveOrderInput.id) ||
        (idempotencyKey && o.idempotencyKey === idempotencyKey)
    );
    if (existingByIdOrKey) {
      const replayRes = {
        success: true,
        order: existingByIdOrKey,
        alreadyExisted: true,
        idempotentReplay: true
      };
      if (idempotencyKey) saveIdempotency(idempotencyKey, replayRes);
      return replayRes;
    }

    const suppliers: any[] = Array.isArray(storeData.settings?.suppliers)
      ? storeData.settings.suppliers
      : Object.values(storeData.settings?.suppliers || {});

    let matchedMerchant: any = null;
    if (effectiveOrderInput.merchantId) {
      matchedMerchant = suppliers.find(s => s.id === effectiveOrderInput.merchantId);
    }

    // Audit Fix #7: Block merchant self-creation if subscribed to an active Dedicated Manager plan
    if (normalizedRole === 'merchant' && matchedMerchant && isPlanCycleCurrentlyActive(matchedMerchant.managerPlan, nowMs)) {
      return {
        success: false,
        code: 'DedicatedManagerOrderCreationForbidden',
        message: 'MERCHANT_ORDER_CREATION_FORBIDDEN: الموكل المشترك في باقة المدير المخصص لا يمكنه إنشاء الأوردرات بنفسه؛ تتولى الإدارة إنشاءها نيابةً عنه.'
      };
    }

    // Audit Fix #9 & #12: Validate & reserve inventory stock atomically inside the store lock
    const products: any[] = Array.isArray((storeData.settings as any)?.products)
      ? (storeData.settings as any).products
      : [];
    const requestedItems = Array.isArray(effectiveOrderInput.items) ? effectiveOrderInput.items : [];

    if (enforceStockAvailability) {
      for (const reqItem of requestedItems) {
        const pid = reqItem.productId || reqItem.id;
        const reqQty = Math.max(1, Number(reqItem.quantity || 1));
        if (pid) {
          const prod = products.find(p => p.id === pid);
          if (prod) {
            const available = Number(prod.stockQuantity ?? prod.stock ?? prod.quantity ?? 0);
            if (reqQty > available) {
              return {
                success: false,
                code: 'InsufficientStock',
                message: `INSUFFICIENT_STOCK: الكمية المطلوبة (${reqQty}) للمنتج [${prod.name || pid}] تتجاوز المخزون المتاح (${available})`
              };
            }
          }
        }
      }
    }

    // Deduct reserved stock
    const nowIso = safeIsoDate(nowMs);
    for (const reqItem of requestedItems) {
      const pid = reqItem.productId || reqItem.id;
      const reqQty = Math.max(1, Number(reqItem.quantity || 1));
      if (pid) {
        const prodIdx = products.findIndex(p => p.id === pid);
        if (prodIdx >= 0) {
          const prod = products[prodIdx];
          const available = Number(prod.stockQuantity ?? prod.stock ?? prod.quantity ?? 0);
          const nextStock = Math.max(0, available - reqQty);
          products[prodIdx] = {
            ...prod,
            stock: nextStock,
            stockQuantity: nextStock,
            quantity: nextStock,
            updatedAt: nowIso,
            version: Number(prod.version || 0) + 1
          };
        }
      }
    }
    if (storeData.settings) {
      (storeData.settings as any).products = products;
    }

    // Audit Fix #8: Collision-free unique ID & display orderNumber
    const uniqueId = effectiveOrderInput.id || generateUniqueOrderId('ord');
    const displayOrderNumber = effectiveOrderInput.orderNumber || generateDisplayOrderNumber('ORD');

    const planSnapshot = matchedMerchant ? buildOrderPlanSnapshot(matchedMerchant, nowMs) : {};

    const newOrder: Order = {
      ...effectiveOrderInput,
      ...planSnapshot,
      id: uniqueId,
      orderNumber: displayOrderNumber,
      customerName: effectiveOrderInput.customerName,
      customerPhone: effectiveOrderInput.customerPhone,
      customerAddress: effectiveOrderInput.customerAddress || (effectiveOrderInput as any).address || '',
      shippingCompany: effectiveOrderInput.shippingCompany || 'بوسطه',
      shippingArea: effectiveOrderInput.shippingArea || effectiveOrderInput.governorate || 'القاهرة',
      status: (effectiveOrderInput.status || 'جاري_المراجعة') as OrderStatus,
      paymentStatus: effectiveOrderInput.paymentStatus || 'بانتظار الدفع',
      preparationStatus: effectiveOrderInput.preparationStatus || 'بانتظار التجهيز',
      productName: effectiveOrderInput.productName || requestedItems[0]?.name || 'منتج',
      productPrice: Number(effectiveOrderInput.productPrice ?? effectiveOrderInput.totalPrice ?? 0),
      productCost: Number(effectiveOrderInput.productCost ?? 0),
      totalPrice: Number(effectiveOrderInput.totalPrice ?? (effectiveOrderInput as any).totalAmount ?? 0),
      shippingFee: Number(effectiveOrderInput.shippingFee ?? 0),
      weight: Number(effectiveOrderInput.weight ?? 1),
      discount: Number(effectiveOrderInput.discount ?? 0),
      date: effectiveOrderInput.date || nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
      stockDeducted: requestedItems.length > 0,
      items: requestedItems as any
    };
    (newOrder as any).version = 1;
    if (idempotencyKey) {
      (newOrder as any).idempotencyKey = idempotencyKey;
    }

    storeData.orders = [newOrder, ...currentOrders.filter(o => o.id !== uniqueId)];

    if (adapter) {
      await adapter.saveStoreData(storeId, storeData);
    } else if (storeRef) {
      const orderDocId = uniqueId.startsWith(storeId) ? uniqueId : `${storeId}_${uniqueId}`;
      await setDoc(doc(db, 'orders', orderDocId), { ...newOrder, storeId, store_id: storeId }, { merge: true });
      await setDoc(storeRef, {
        orders: storeData.orders,
        settings: storeData.settings
      }, { merge: true });
    }

    const res = { success: true, order: newOrder, alreadyExisted: false, idempotentReplay: false };
    if (idempotencyKey) {
      await savePersistentIdempotency(idempotencyKey, res);
    }
    return res;
  } finally {
    unlock();
  }
}

/**
 * Atomic Merchant Withdrawal Processing
 * Fixes Acceptance Test #13: Prevents concurrent withdrawals from exceeding available balance.
 */
export async function processMerchantWithdrawalAtomic(
  adapterOrParams: StoreDataAdapter | any,
  maybeParams?: any
): Promise<{
  success: boolean;
  code?: string;
  message?: string;
  withdrawnAmount?: number;
  newBalance?: number;
  transaction?: MerchantTransaction;
  idempotentReplay?: boolean;
}> {
  const hasAdapter =
    adapterOrParams &&
    typeof adapterOrParams.getStoreData === 'function' &&
    typeof adapterOrParams.saveStoreData === 'function';
  const adapter: StoreDataAdapter | null = hasAdapter ? adapterOrParams : null;
  const params = hasAdapter ? maybeParams : adapterOrParams;

  const { storeId, merchantId, amount, idempotencyKey, authorizedStoreIds, actorStoreId, inMemoryStoreData } = params || {};
  if (Array.isArray(authorizedStoreIds) && authorizedStoreIds.length > 0 && !authorizedStoreIds.includes(storeId)) {
    return {
      success: false,
      code: 'CrossStoreAccessDenied',
      message: `CROSS_STORE_ACCESS_DENIED: لا تملك صلاحية الوصول إلى المتجر [${storeId}]`
    };
  }
  if (actorStoreId && actorStoreId !== storeId) {
    return {
      success: false,
      code: 'CrossStoreAccessDenied',
      message: `CROSS_STORE_ACCESS_DENIED: لا تملك صلاحية الوصول إلى المتجر [${storeId}]`
    };
  }

  const effectiveKey = idempotencyKey || `withdraw_${storeId}_${merchantId}_${amount}`;

  const cached = await getPersistentIdempotency(effectiveKey);
  if (cached) return { ...cached, idempotentReplay: true };

  const unlock = await mutex.acquire(`store_${storeId}`);
  try {
    const cachedInside = await getPersistentIdempotency(effectiveKey);
    if (cachedInside) return { ...cachedInside, idempotentReplay: true };

    if (!adapter && !inMemoryStoreData && db) {
      return await runTransaction(db, async (tx) => {
        const idempRef = doc(db, 'idempotency_records', effectiveKey);
        const idempSnap = await tx.get(idempRef);
        if (idempSnap.exists()) {
          const replayRes = idempSnap.data()?.result;
          if (replayRes) {
            saveIdempotency(effectiveKey, replayRes);
            return { ...replayRes, idempotentReplay: true };
          }
        }

        const storeRef = doc(db, 'stores_data', storeId);
        const snap = await tx.get(storeRef);
        if (!snap.exists()) return { success: false, code: 'StoreNotFound', message: `المتجر غير موجود: [${storeId}]` };
        const storeData = snap.data() as StoreData;

        const suppliers: any[] = Array.isArray(storeData.settings?.suppliers) ? storeData.settings.suppliers : [];

        let merchant = suppliers.find(s => s.id === merchantId);
        if (!merchant) {
          return { success: false, code: 'MerchantNotFound', message: `الموكل غير موجود: [${merchantId}]` };
        }

        const reqPiasters = toPiasters(amount);
        if (reqPiasters <= 0) {
          return { success: false, code: 'InvalidAmount', message: 'مبلغ السحب يجب أن يكون أكبر من صفر' };
        }

        const curPiasters = toPiasters(Number(merchant.balance || 0));
        if (reqPiasters > curPiasters) {
          return {
            success: false,
            code: 'InsufficientBalance',
            message: `INSUFFICIENT_WALLET_BALANCE: الرصيد المتاح (${fromPiasters(curPiasters)} ج.م) لا يكفي لصرف مبلغ (${fromPiasters(reqPiasters)} ج.م)`
          };
        }

        const nextBal = fromPiasters(curPiasters - reqPiasters);
        const nowIso = safeIsoDate();
        const txRecord: MerchantTransaction = {
          id: `WTH-${merchantId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          merchantId: merchant.id,
          merchantName: merchant.name,
          date: nowIso,
          type: 'withdrawal',
          amount: -fromPiasters(reqPiasters),
          balanceAfter: nextBal,
          referenceId: effectiveKey,
          notes: `سحب نقدي معتمد من محفظة الموكل`
        };

        merchant.balance = nextBal;
        merchant.transactions = [txRecord, ...(merchant.transactions || [])];

        storeData.settings.suppliers = suppliers.map(s => s.id === merchant.id ? merchant : s);

        tx.set(storeRef, { settings: storeData.settings }, { merge: true });

        const txRes = {
          success: true,
          withdrawnAmount: fromPiasters(reqPiasters),
          newBalance: nextBal,
          transaction: txRecord
        };

        tx.set(idempRef, {
          key: effectiveKey,
          result: txRes,
          timestamp: Date.now(),
          createdAt: nowIso,
          expiresAt: Date.now() + IDEMPOTENCY_TTL_MS
        }, { merge: true });

        saveIdempotency(effectiveKey, txRes);
        return txRes;
      });
    }

    let storeData: StoreData;
    let storeRef: any = null;

    if (adapter) {
      const loaded = await adapter.getStoreData(storeId);
      if (!loaded) return { success: false, code: 'StoreNotFound', message: `المتجر غير موجود: [${storeId}]` };
      storeData = loaded;
    } else if (inMemoryStoreData) {
      storeData = inMemoryStoreData;
    } else {
      storeRef = doc(db, 'stores_data', storeId);
      const snap = await getDoc(storeRef);
      if (!snap.exists()) return { success: false, code: 'StoreNotFound', message: `المتجر غير موجود: [${storeId}]` };
      storeData = snap.data() as StoreData;
    }

    const suppliers: any[] = Array.isArray(storeData.settings?.suppliers) ? storeData.settings.suppliers : [];

    let merchant = suppliers.find(s => s.id === merchantId);
    if (!merchant) {
      return { success: false, code: 'MerchantNotFound', message: `الموكل غير موجود: [${merchantId}]` };
    }

    const reqPiasters = toPiasters(amount);
    if (reqPiasters <= 0) {
      return { success: false, code: 'InvalidAmount', message: 'مبلغ السحب يجب أن يكون أكبر من صفر' };
    }

    const curPiasters = toPiasters(Number(merchant.balance || 0));
    if (reqPiasters > curPiasters) {
      return {
        success: false,
        code: 'InsufficientBalance',
        message: `INSUFFICIENT_WALLET_BALANCE: الرصيد المتاح (${fromPiasters(curPiasters)} ج.م) لا يكفي لصرف مبلغ (${fromPiasters(reqPiasters)} ج.م)`
      };
    }

    const nextBal = fromPiasters(curPiasters - reqPiasters);
    const nowIso = safeIsoDate();
    const tx: MerchantTransaction = {
      id: `WTH-${merchantId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      merchantId: merchant.id,
      merchantName: merchant.name,
      date: nowIso,
      type: 'withdrawal',
      amount: -fromPiasters(reqPiasters),
      balanceAfter: nextBal,
      referenceId: effectiveKey,
      notes: `سحب نقدي معتمد من محفظة الموكل`
    };

    merchant.balance = nextBal;
    merchant.transactions = [tx, ...(merchant.transactions || [])];

    storeData.settings.suppliers = suppliers.map(s => s.id === merchant.id ? merchant : s);

    if (adapter) {
      await adapter.saveStoreData(storeId, storeData);
    } else if (storeRef) {
      await setDoc(storeRef, { settings: storeData.settings }, { merge: true });
    }

    const res = {
      success: true,
      withdrawnAmount: fromPiasters(reqPiasters),
      newBalance: nextBal,
      transaction: tx
    };
    await savePersistentIdempotency(effectiveKey, res);
    return res;
  } finally {
    unlock();
  }
}

/**
 * Atomic & Idempotent Shipping Webhook / Order Settlement Processor
 * Fixes Acceptance Test #14: Prevents duplicate carrier notifications or duplicate settlements
 * from creating duplicate collection entries or duplicate return stock restocks.
 */
export async function processCarrierEventOrSettlementAtomic(
  adapterOrParams: StoreDataAdapter | any,
  maybeParams?: any
): Promise<{
  success: boolean;
  order: Order;
  newMerchantBalance: number;
  alreadyProcessed: boolean;
  idempotentReplay: boolean;
}> {
  const hasAdapter =
    adapterOrParams &&
    typeof adapterOrParams.getStoreData === 'function' &&
    typeof adapterOrParams.saveStoreData === 'function';
  const adapter: StoreDataAdapter | null = hasAdapter ? adapterOrParams : null;
  const params = hasAdapter ? maybeParams : adapterOrParams;

  const {
    storeId,
    orderId,
    eventKey,
    eventId,
    targetStatus,
    newStatus,
    collectionAmount,
    merchantCreditAmount,
    restockOnReturn = false,
    inMemoryStoreData
  } = params || {};

  const effectiveEventKey = eventKey || eventId || `evt_${targetStatus || newStatus}`;
  const effectiveStatus = (targetStatus || newStatus || 'تم_التوصيل') as OrderStatus;
  const effectiveCreditAmount = Number(collectionAmount ?? merchantCreditAmount ?? 0);

  const idempotencyKey = `carrier_event_${storeId}_${orderId}_${effectiveEventKey}`;
  const cached = checkIdempotency(idempotencyKey);
  if (cached) return { ...cached, alreadyProcessed: true, idempotentReplay: true };

  const unlock = await mutex.acquire(`store_${storeId}`);
  try {
    const cachedInside = checkIdempotency(idempotencyKey);
    if (cachedInside) return { ...cachedInside, alreadyProcessed: true, idempotentReplay: true };

    let storeData: StoreData;
    let storeRef: any = null;
    if (adapter) {
      const loaded = await adapter.getStoreData(storeId);
      if (!loaded) throw new Error(`المتجر غير موجود: [${storeId}]`);
      storeData = loaded;
    } else if (inMemoryStoreData) {
      storeData = inMemoryStoreData;
    } else {
      storeRef = doc(db, 'stores_data', storeId);
      const snap = await getDoc(storeRef);
      if (!snap.exists()) throw new Error(`المتجر غير موجود: [${storeId}]`);
      storeData = snap.data() as StoreData;
    }

    const orders = Array.isArray(storeData.orders) ? storeData.orders : [];
    const idx = orders.findIndex(o => o.id === orderId || o.orderNumber === orderId);
    if (idx === -1) throw new Error(`الطلب غير موجود: [${orderId}]`);

    const order = orders[idx];
    const suppliers: any[] = Array.isArray(storeData.settings?.suppliers) ? storeData.settings.suppliers : [];
    const merchant = suppliers.find(s => s.id === (params.merchantId || order.merchantId));

    // Check if eventKey or settlement already processed on the order itself
    const timeline = Array.isArray(order.shipmentTimeline) ? order.shipmentTimeline : [];
    const alreadyProcessedEvent =
      order.lastShippingEventKey === effectiveEventKey ||
      timeline.some(e => e.eventKey === effectiveEventKey) ||
      ((effectiveStatus === 'تم_التحصيل' || effectiveStatus === 'تم_التوصيل') && order.collectionProcessed);

    if (alreadyProcessedEvent) {
      const replay = {
        success: true,
        order,
        newMerchantBalance: Number(merchant?.balance || 0),
        alreadyProcessed: true,
        idempotentReplay: true
      };
      saveIdempotency(idempotencyKey, replay);
      return replay;
    }

    const nowIso = safeIsoDate();
    let newBalance = Number(merchant?.balance || 0);

    if (
      (effectiveStatus === 'تم_التحصيل' || effectiveStatus === 'تم_التوصيل') &&
      merchant &&
      effectiveCreditAmount > 0 &&
      !order.collectionProcessed
    ) {
      const curPiasters = toPiasters(newBalance);
      const addPiasters = toPiasters(effectiveCreditAmount);
      newBalance = fromPiasters(curPiasters + addPiasters);
      const colTx: MerchantTransaction = {
        id: `COL-${merchant.id}-${order.id}`,
        merchantId: merchant.id,
        merchantName: merchant.name,
        date: nowIso,
        type: 'order_profit',
        amount: fromPiasters(addPiasters),
        balanceAfter: newBalance,
        referenceId: order.id,
        notes: `تحصيل وتسوية الأوردر #${order.orderNumber}`
      };
      merchant.balance = newBalance;
      merchant.transactions = [colTx, ...(merchant.transactions || [])];
      order.collectionProcessed = true;
      order.settlementStatus = 'settled';
    }

    if ((effectiveStatus === 'مرتجع' || effectiveStatus === 'فشل_التوصيل') && restockOnReturn && order.stockDeducted) {
      const products: any[] = Array.isArray((storeData.settings as any)?.products)
        ? (storeData.settings as any).products
        : [];
      for (const item of order.items || []) {
        const pid = item.productId || (item as any).id;
        const pIdx = products.findIndex(p => p.id === pid);
        if (pIdx >= 0) {
          const curStock = Number(products[pIdx].stockQuantity ?? products[pIdx].stock ?? 0);
          const nextStock = curStock + Number(item.quantity || 1);
          products[pIdx] = {
            ...products[pIdx],
            stock: nextStock,
            stockQuantity: nextStock,
            quantity: nextStock
          };
        }
      }
      order.stockDeducted = false; // Prevent double restock on repeated return webhook
    }

    order.status = effectiveStatus;
    order.lastShippingEventKey = effectiveEventKey;
    order.lastShippingEventAt = nowIso;
    order.shipmentTimeline = [
      ...timeline,
      {
        carrier: order.shippingCompany || 'carrier',
        externalStatus: effectiveStatus,
        internalStatus: effectiveStatus,
        eventAt: nowIso,
        receivedAt: nowIso,
        source: 'webhook',
        eventKey: effectiveEventKey
      }
    ];

    orders[idx] = order;
    storeData.orders = orders;

    if (adapter) {
      await adapter.saveStoreData(storeId, storeData);
    } else if (storeRef) {
      await setDoc(storeRef, { orders: storeData.orders, settings: storeData.settings }, { merge: true });
    }

    const result = {
      success: true,
      order,
      newMerchantBalance: newBalance,
      alreadyProcessed: false,
      idempotentReplay: false
    };
    saveIdempotency(idempotencyKey, result);
    return result;
  } finally {
    unlock();
  }
}

/**
 * Server-Authoritative Plan Activation & Safe Wallet Deduction
 * 
 * Rules:
 * - 1,000 EGP for 30 days under monthly_1000.
 * - Deducts from wallet atomically.
 * - If wallet balance is insufficient: REJECTS without activating plan.
 * - Prevents duplicate activations via idempotency key.
 */
export async function activateMerchantManagerPlan(params: {
  storeId: string;
  merchantId: string;
  planId: DedicatedManagerPlanId;
  billingCycle?: BillingCycleType;
  idempotencyKey?: string;
  inMemoryStoreData?: StoreData;
}): Promise<{
  success: boolean;
  merchant: any;
  chargeAmount: number;
  newBalance: number;
  message: string;
}> {
  const { storeId, merchantId, planId, billingCycle = 'monthly', idempotencyKey, inMemoryStoreData } = params;
  const effectiveKey = idempotencyKey || `activate_plan_${storeId}_${merchantId}_${planId}_${billingCycle}`;

  const cached = checkIdempotency(effectiveKey);
  if (cached) return cached;

  const unlock = await mutex.acquire(`store_${storeId}`);

  try {
    const cachedInside = checkIdempotency(effectiveKey);
    if (cachedInside) return cachedInside;

    let storeData: StoreData;
    let storeRef: any = null;

    if (inMemoryStoreData) {
      storeData = inMemoryStoreData;
    } else {
      storeRef = doc(db, 'stores_data', storeId);
      const snap = await getDoc(storeRef);
      if (!snap.exists()) throw new Error(`المتجر غير موجود: [${storeId}]`);
      storeData = snap.data() as StoreData;
    }

    const suppliers: any[] = Array.isArray(storeData.settings?.suppliers)
      ? storeData.settings.suppliers
      : Object.values(storeData.settings?.suppliers || {});

    let merchant = suppliers.find(s => s.id === merchantId);

    if (!merchant) {
      throw new Error(`الموكل غير موجود: [${merchantId}]`);
    }

    const planDef = DEDICATED_MANAGER_PLANS.find(p => p.id === planId) || DEDICATED_MANAGER_PLANS[0];
    const cycle = BILLING_CYCLES.find(c => c.id === billingCycle) || BILLING_CYCLES[0];
    const pricing = computeManagerPlanPricing(planDef, billingCycle);
    const chargeAmount = pricing.totalCyclePrice; // 1,000 EGP for monthly_1000

    const currentBalPiasters = toPiasters(Number(merchant.balance || 0));
    const chargePiasters = toPiasters(chargeAmount);

    // Rule 5: Do NOT activate if payment/balance is insufficient
    if (chargePiasters > currentBalPiasters) {
      const curEgp = fromPiasters(currentBalPiasters);
      throw new Error(
        `رصيد المحفظة (${curEgp} ج.م) غير كافٍ لدفع اشتراك الباقة (${chargeAmount} ج.م). يجب شحن المحفظة أولاً.`
      );
    }

    const nextBalPiasters = currentBalPiasters - chargePiasters;
    const nextBalance = fromPiasters(nextBalPiasters);
    const nowIso = safeIsoDate();
    const endIso = safeIsoDate(Date.now() + cycle.days * 86400000);
    const newCycleId = `MGR-${planId}-${Date.now()}`;

    const newTx: MerchantTransaction = {
      id: `SUB-${newCycleId}`,
      merchantId: merchant.id,
      merchantName: merchant.name,
      date: nowIso,
      type: 'subscription_charge',
      amount: -chargeAmount,
      balanceAfter: nextBalance,
      referenceId: newCycleId,
      notes: `سداد اشتراك ${planDef.nameAr} (${cycle.labelAr}) وتفعيل كوتة الـ 50 أوردر مجاناً`
    };

    const newManagerPlan: MerchantManagerConfig = {
      cycleId: newCycleId,
      planId: planId,
      planName: planDef.nameAr,
      billingCycle: billingCycle,
      orderFee: planId === 'per_order_20' ? 20 : 0,
      monthlyFee: chargeAmount,
      totalPaidAmount: chargeAmount,
      includedOrdersQuota: planDef.includedOrdersQuota ?? 50,
      extraOrderFee: planDef.extraOrderFee ?? 20,
      startDate: nowIso,
      endDate: endIso,
      status: 'active'
    };

    merchant.balance = nextBalance;
    merchant.managerPlan = newManagerPlan;
    merchant.pendingPlanRequest = null;
    merchant.transactions = [newTx, ...(merchant.transactions || [])];

    storeData.settings.suppliers = suppliers.map(s => s.id === merchant.id ? merchant : s);

    if (storeRef) {
      await setDoc(storeRef, { settings: storeData.settings }, { merge: true });
    }

    const result = {
      success: true,
      merchant,
      chargeAmount,
      newBalance: nextBalance,
      message: `تم تفعيل ${planDef.nameAr} بنجاح وخصم ${chargeAmount} ج.م من المحفظة.`
    };

    saveIdempotency(effectiveKey, result);
    return result;
  } finally {
    unlock();
  }
}

/**
 * Reconciles Merchant Wallet Balance with Immutable Transaction Ledger
 */
export function reconcileMerchantLedger(merchant: any): {
  isConsistent: boolean;
  computedBalance: number;
  storedBalance: number;
  discrepancy: number;
  transactionsCount: number;
} {
  const transactions: MerchantTransaction[] = Array.isArray(merchant?.transactions)
    ? merchant.transactions
    : [];

  let sumPiasters = 0;
  for (const tx of transactions) {
    sumPiasters += toPiasters(Number(tx.amount || 0));
  }

  const computedBalance = fromPiasters(sumPiasters);
  const storedBalance = Number(merchant?.balance || 0);
  const discrepancy = Number((storedBalance - computedBalance).toFixed(2));

  return {
    isConsistent: Math.abs(discrepancy) < 0.05,
    computedBalance,
    storedBalance,
    discrepancy,
    transactionsCount: transactions.length
  };
}
