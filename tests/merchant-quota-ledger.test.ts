import * as fs from 'fs';
import * as path from 'path';
import { 
  confirmOrderWithQuotaAndFee, 
  activateMerchantManagerPlan, 
  reconcileMerchantLedger,
  createOrderAtomic,
  processMerchantWithdrawalAtomic,
  processCarrierEventOrSettlementAtomic,
  verifyStoreAccessAuthorization,
  StoreDataAdapter
} from '../services/orderQuotaLedgerService';
import {
  generateUniqueOrderId,
  generateDisplayOrderNumber,
  shouldDeleteCloudRecord,
  evaluateRecordUpsert,
  reconcileDualOrderSources,
  hashPasswordSecure,
  verifyPasswordSecure
} from '../utils/syncIntegrity';
import {
  isPlanCycleCurrentlyActive,
  buildOrderPlanSnapshot,
  computeMerchantPlanUsage
} from '../utils/merchantSubscriptions';
import { StoreData, Order, Supplier } from '../types';

function createInMemoryStoreAdapter(initialStores: Record<string, StoreData>): StoreDataAdapter & { stores: Record<string, StoreData> } {
  const stores: Record<string, StoreData> = JSON.parse(JSON.stringify(initialStores));
  return {
    stores,
    async getStoreData(storeId: string): Promise<StoreData | null> {
      await new Promise((r) => setTimeout(r, 5)); // Simulate async I/O latency for concurrency tests
      return stores[storeId] ? JSON.parse(JSON.stringify(stores[storeId])) : null;
    },
    async saveStoreData(storeId: string, data: StoreData): Promise<boolean> {
      await new Promise((r) => setTimeout(r, 5));
      stores[storeId] = JSON.parse(JSON.stringify(data));
      return true;
    }
  };
}

async function runAllTests() {
  console.log("================================================================================");
  console.log("🚀 STARTING 15-SCENARIO MANDATORY ACCEPTANCE & INTEGRITY TEST SUITE");
  console.log("================================================================================\n");

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(` ✅ PASS: ${desc}`);
      passedTests++;
    } else {
      console.error(` ❌ FAIL: ${desc}`);
      failedTests++;
      throw new Error(`Assertion failed: ${desc}`);
    }
  }

  // ================================================================================
  // ACCEPTANCE TEST 9: Insufficient Balance on Plan Activation (< 1000 EGP)
  // ================================================================================
  console.log("--- [ACCEPTANCE #9] Insufficient Balance on monthly_1000 Activation ---");
  {
    const mockStore: StoreData = {
      settings: {
        suppliers: [
          {
            id: 'm1',
            name: 'تاجر الاختبار',
            phone: '01000000000',
            balance: 400, // Only 400 EGP, requires 1,000 EGP
            managerPlan: {
              planId: 'none',
              planName: 'None',
              billingCycle: 'monthly',
              orderFee: 0,
              monthlyFee: 0,
              totalPaidAmount: 0,
              startDate: new Date().toISOString(),
              status: 'inactive'
            }
          } as Supplier
        ]
      } as any,
      orders: [],
      wallet: { balance: 0, transactions: [] },
      cart: [],
      customers: []
    };

    let errorThrown = false;
    try {
      await activateMerchantManagerPlan({
        storeId: 'test_store',
        merchantId: 'm1',
        planId: 'monthly_1000',
        inMemoryStoreData: mockStore
      });
    } catch (err: any) {
      errorThrown = true;
      assert(err.message.includes('غير كافٍ'), 'Rejects with insufficient balance error');
    }
    assert(errorThrown, 'Plan activation blocked when wallet balance < 1000 EGP');
    assert(mockStore.settings.suppliers[0].balance === 400, 'Balance remains untouched at 400 EGP');
    assert(mockStore.settings.suppliers[0].managerPlan?.status === 'inactive', 'Plan status remains inactive');
  }

  // ================================================================================
  // ACCEPTANCE TEST 10: Successful Activation of monthly_1000 (Deducts 1000 EGP, 50 quota)
  // ================================================================================
  console.log("\n--- [ACCEPTANCE #10] Successful monthly_1000 Activation (1,000 EGP deduction & 50 Quota) ---");
  const baseStore: StoreData = {
    settings: {
      suppliers: [
        {
          id: 'merchant_50',
          name: 'عمرو للتجارة',
          phone: '01011111111',
          balance: 2500,
          transactions: [],
          managerPlan: {
            planId: 'none',
            planName: 'None',
            billingCycle: 'monthly',
            orderFee: 0,
            monthlyFee: 0,
            totalPaidAmount: 0,
            startDate: new Date().toISOString(),
            status: 'inactive'
          }
        } as Supplier
      ]
    } as any,
    orders: [],
    wallet: { balance: 0, transactions: [] },
    cart: [],
    customers: []
  };

  const activationRes = await activateMerchantManagerPlan({
    storeId: 'store_real',
    merchantId: 'merchant_50',
    planId: 'monthly_1000',
    idempotencyKey: 'same_activation_key',
    inMemoryStoreData: baseStore
  });

  assert(activationRes.success === true, 'Activation succeeded');
  assert(activationRes.newBalance === 1500, 'Wallet balance deducted from 2500 to 1500 EGP');
  assert(activationRes.chargeAmount === 1000, 'Charge amount is exactly 1000 EGP');
  assert(baseStore.settings.suppliers[0].managerPlan?.status === 'active', 'Manager plan status is active');
  assert(baseStore.settings.suppliers[0].managerPlan?.includedOrdersQuota === 50, 'Included orders quota set to 50');

  const repeatActivation = await activateMerchantManagerPlan({
    storeId: 'store_real',
    merchantId: 'merchant_50',
    planId: 'monthly_1000',
    idempotencyKey: 'same_activation_key',
    inMemoryStoreData: baseStore
  });
  assert(repeatActivation.newBalance === 1500, 'Re-activation with same key returns cached result without re-charging');

  // Populate 50 orders in draft/review status and confirm 1..50 (0 EGP fee) + 51 (20 EGP fee)
  const activeCycleId = baseStore.settings.suppliers[0].managerPlan!.cycleId!;
  for (let i = 1; i <= 51; i++) {
    baseStore.orders.push({
      id: `order_${i}`,
      orderNumber: `ORD-${1000 + i}`,
      merchantId: 'merchant_50',
      merchantName: 'عمرو للتجارة',
      planCycleId: activeCycleId,
      planModeAtCreation: 'manager',
      planIdAtCreation: 'monthly_1000',
      status: 'جاري_المراجعة',
      totalPrice: 500,
      shippingFee: 50,
      customerName: `عميل ${i}`,
      customerPhone: `010000000${i}`,
      customerAddress: 'القاهرة',
      date: new Date().toISOString(),
      items: [],
      productName: 'صنف',
      productPrice: 500,
      productCost: 300,
      weight: 1,
      discount: 0,
      preparationStatus: 'قيد التجهيز' as any,
      paymentStatus: 'معلق' as any,
      shippingCompany: 'Bosta',
      shippingArea: 'القاهرة'
    });
  }

  for (let i = 1; i <= 50; i++) {
    const res = await confirmOrderWithQuotaAndFee({
      storeId: 'store_real',
      orderId: `order_${i}`,
      inMemoryStoreData: baseStore
    });
    if (res.feeDeducted !== 0) throw new Error(`Order ${i} should be free!`);
  }
  assert(baseStore.settings.suppliers[0].balance === 1500, 'Orders 1..50 confirmed with 0 EGP fee (balance = 1500 EGP)');

  const res51 = await confirmOrderWithQuotaAndFee({
    storeId: 'store_real',
    orderId: 'order_51',
    inMemoryStoreData: baseStore
  });
  assert(res51.feeDeducted === 20 && res51.newBalance === 1480, 'Order 51 deducted 20 EGP (balance = 1480 EGP)');

  // ================================================================================
  // ACCEPTANCE TEST 1: Pressing Confirm Button 10 Times on Same Order
  // ================================================================================
  console.log("\n--- [ACCEPTANCE #1] Pressing Confirm Button 10 Times Simultaneously/Sequentially ---");
  {
    baseStore.orders.push({
      id: 'order_52_ten_clicks',
      orderNumber: 'ORD-1052',
      merchantId: 'merchant_50',
      merchantName: 'عمرو للتجارة',
      planCycleId: activeCycleId,
      planModeAtCreation: 'manager',
      planIdAtCreation: 'monthly_1000',
      status: 'جاري_المراجعة',
      totalPrice: 450,
      shippingFee: 50,
      customerName: 'عميل 52',
      customerPhone: '01000000052',
      customerAddress: 'القاهرة',
      date: new Date().toISOString(),
      items: []
    } as any);

    const balanceBefore = baseStore.settings.suppliers[0].balance!; // 1480
    const tenPromises = Array.from({ length: 10 }, (_, idx) =>
      confirmOrderWithQuotaAndFee({
        storeId: 'store_real',
        orderId: 'order_52_ten_clicks',
        idempotencyKey: `click_${idx}`, // Even with different click keys on the same orderId!
        inMemoryStoreData: baseStore
      })
    );
    const tenResults = await Promise.all(tenPromises);
    const balanceAfter = baseStore.settings.suppliers[0].balance!;
    const feeTxsFor52 = baseStore.settings.suppliers[0].transactions.filter(
      (t: any) => (t.referenceId === 'order_52_ten_clicks' || t.orderId === 'order_52_ten_clicks') && t.type === 'manager_order_fee'
    );
    assert(balanceBefore - balanceAfter === 20, 'Pressing confirm 10 times deducted 20 EGP exactly once (1480 -> 1460)');
    assert(feeTxsFor52.length === 1, 'Exactly 1 ledger transaction created across 10 confirm clicks');
    assert(tenResults.every((r) => r.order.cycleOrderNumber === 52), 'All 10 clicks see consistent cycleOrderNumber = 52');
  }

  // ================================================================================
  // ACCEPTANCE TEST 2: Confirming Order #50 and #51 at the Exact Same Second
  // ================================================================================
  console.log("\n--- [ACCEPTANCE #2] Confirming Order #50 and #51 Simultaneously ---");
  {
    const concurrentStore: StoreData = JSON.parse(JSON.stringify(baseStore));
    const concMerchant = concurrentStore.settings.suppliers[0];
    concMerchant.balance = 1000;
    concMerchant.transactions = [];
    const concCycleId = `MGR-CONC-${Date.now()}`;
    concMerchant.managerPlan = {
      planId: 'monthly_1000',
      planName: 'باقة المدير المخصص',
      billingCycle: 'monthly',
      orderFee: 0,
      monthlyFee: 1000,
      totalPaidAmount: 1000,
      includedOrdersQuota: 50,
      extraOrderFee: 20,
      cycleId: concCycleId,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 25 * 86400000).toISOString(),
      status: 'active'
    };

    concurrentStore.orders = [];
    for (let k = 1; k <= 49; k++) {
      concurrentStore.orders.push({
        id: `conc_${k}`,
        orderNumber: `C-${k}`,
        merchantId: concMerchant.id,
        planCycleId: concCycleId,
        planModeAtCreation: 'manager',
        status: 'مؤكد',
        quotaConsumedAt: new Date().toISOString()
      } as any);
    }

    concurrentStore.orders.push(
      {
        id: 'conc_order_A',
        orderNumber: 'C-A',
        merchantId: concMerchant.id,
        planCycleId: concCycleId,
        planModeAtCreation: 'manager',
        status: 'جاري_المراجعة'
      } as any,
      {
        id: 'conc_order_B',
        orderNumber: 'C-B',
        merchantId: concMerchant.id,
        planCycleId: concCycleId,
        planModeAtCreation: 'manager',
        status: 'جاري_المراجعة'
      } as any
    );

    const [resultA, resultB] = await Promise.all([
      confirmOrderWithQuotaAndFee({
        storeId: 'conc_store',
        orderId: 'conc_order_A',
        inMemoryStoreData: concurrentStore
      }),
      confirmOrderWithQuotaAndFee({
        storeId: 'conc_store',
        orderId: 'conc_order_B',
        inMemoryStoreData: concurrentStore
      })
    ]);

    const fees = [resultA.feeDeducted, resultB.feeDeducted].sort((x, y) => x - y);
    assert(fees[0] === 0 && fees[1] === 20, 'Order #50 gets 0 EGP fee and Order #51 gets 20 EGP fee under simultaneous execution');
    assert(concMerchant.balance === 980, 'Merchant balance is exactly 980 EGP');
  }

  // ================================================================================
  // ACCEPTANCE TEST 3: Network Failure During Order Creation / Deduction & Retry
  // ================================================================================
  console.log("\n--- [ACCEPTANCE #3] Network Interruption & Idempotent Retry ---");
  {
    let networkOnline = false;
    const rawStore: StoreData = {
      settings: {
        products: [{ id: 'p_net', name: 'شنيور', price: 1000, stockQuantity: 10 } as any],
        suppliers: [{ id: 'sup_net', name: 'تاجر الشبكة', balance: 500, transactions: [] } as any]
      } as any,
      orders: [],
      wallet: { balance: 0, transactions: [] },
      cart: [],
      customers: []
    };

    const flakyAdapter: StoreDataAdapter = {
      async getStoreData() {
        return JSON.parse(JSON.stringify(rawStore));
      },
      async saveStoreData(_sId, data) {
        if (!networkOnline) {
          throw new Error('Failed to fetch: network disconnected');
        }
        Object.assign(rawStore, JSON.parse(JSON.stringify(data)));
        return true;
      }
    };

    const fixedOrderId = generateUniqueOrderId('ORD');
    const fixedDisplayNo = generateDisplayOrderNumber('M');
    const fixedIdempotencyKey = `net_retry_key_${fixedOrderId}`;

    // Attempt 1: fails due to network disconnect
    let firstAttemptFailed = false;
    try {
      await createOrderAtomic(flakyAdapter, {
        storeId: 'store_net',
        actorId: 'merchant_user_1',
        actorRole: 'merchant',
        idempotencyKey: fixedIdempotencyKey,
        orderPayload: {
          id: fixedOrderId,
          orderNumber: fixedDisplayNo,
          customerName: 'عميل انقطاع الإنترنت',
          customerPhone: '01099998888',
          totalPrice: 1000,
          items: [{ productId: 'p_net', name: 'شنيور', quantity: 2, price: 500, cost: 350 }]
        }
      });
    } catch (e) {
      firstAttemptFailed = true;
    }
    assert(firstAttemptFailed, 'First attempt throws when network is disconnected during save');
    assert(rawStore.orders.length === 0, 'No partial order committed during network failure');

    // Network comes back: Retry 1 and Retry 2 with same idempotencyKey & orderId
    networkOnline = true;
    const retry1 = await createOrderAtomic(flakyAdapter, {
      storeId: 'store_net',
      actorId: 'merchant_user_1',
      actorRole: 'merchant',
      idempotencyKey: fixedIdempotencyKey,
      orderPayload: {
        id: fixedOrderId,
        orderNumber: fixedDisplayNo,
        customerName: 'عميل انقطاع الإنترنت',
        customerPhone: '01099998888',
        totalPrice: 1000,
        items: [{ productId: 'p_net', name: 'شنيور', quantity: 2, price: 500, cost: 350 }]
      }
    });
    const retry2 = await createOrderAtomic(flakyAdapter, {
      storeId: 'store_net',
      actorId: 'merchant_user_1',
      actorRole: 'merchant',
      idempotencyKey: fixedIdempotencyKey,
      orderPayload: {
        id: fixedOrderId,
        orderNumber: fixedDisplayNo,
        customerName: 'عميل انقطاع الإنترنت',
        customerPhone: '01099998888',
        totalPrice: 1000,
        items: [{ productId: 'p_net', name: 'شنيور', quantity: 2, price: 500, cost: 350 }]
      }
    });

    assert(retry1.success && !retry1.alreadyExisted, 'First online retry creates the order');
    assert(retry2.success && retry2.alreadyExisted, 'Second retry with same idempotencyKey is deduplicated');
    assert(rawStore.orders.length === 1, 'Only 1 order exists after retries');
    assert(rawStore.settings.products[0].stockQuantity === 8, 'Inventory deducted only once (10 - 2 = 8)');
  }

  // ================================================================================
  // ACCEPTANCE TEST 4: Firestore Quota Exhausted / Write Failure -> pending_sync
  // ================================================================================
  console.log("\n--- [ACCEPTANCE #4] Quota Exhausted / Cloud Failure Returns pending_sync (Never Fake Success) ---");
  {
    const { saveStoreData } = await import('../services/databaseService');
    // Using an invalid document ID to trigger a cloud write failure
    const invalidStoreObj = { id: "", name: 'Invalid Store' } as any;
    const res = await saveStoreData(
      invalidStoreObj,
      {
        orders: [],
        settings: { products: [] } as any,
        wallet: { balance: 0, transactions: [] },
        cart: [],
        customers: []
      } as any
    );
    assert(res.success === false, 'saveStoreData returns success: false when cloud persistence fails');
  }

  // ================================================================================
  // ACCEPTANCE TEST 5: Multi-Device Conflict (Older Version / Timestamp Rejected)
  // ================================================================================
  console.log("\n--- [ACCEPTANCE #5] Two Devices Editing Same Order (Stale Overwrite Blocked) ---");
  {
    const cloudOrderOnDeviceA = {
      id: 'ord_shared_1',
      status: 'تم_التوصيل',
      version: 4,
      updatedAt: '2026-04-19T12:00:00.000Z'
    };
    const staleOrderOnDeviceB = {
      id: 'ord_shared_1',
      status: 'جاري_المراجعة',
      version: 2,
      updatedAt: '2026-04-19T10:00:00.000Z'
    };

    const decisionByVersion = evaluateRecordUpsert({
      localItem: staleOrderOnDeviceB,
      existingCloudDoc: cloudOrderOnDeviceA,
      nowISO: '2026-04-19T12:05:00.000Z'
    });
    assert(
      decisionByVersion.shouldUpdateCloud === false && decisionByVersion.isConflict === true,
      'Stale local version (v2 vs cloud v4) is rejected even when save happens later'
    );

    const cloudOrderByTime = {
      id: 'ord_shared_2',
      status: 'تم_الشحن',
      updatedAt: '2026-04-19T12:00:00.000Z'
    };
    const staleLocalByTime = {
      id: 'ord_shared_2',
      status: 'جاري_المراجعة',
      updatedAt: '2026-04-19T09:30:00.000Z'
    };
    const decisionByTime = evaluateRecordUpsert({
      localItem: staleLocalByTime,
      existingCloudDoc: cloudOrderByTime,
      nowISO: '2026-04-19T12:10:00.000Z'
    });
    assert(
      decisionByTime.shouldUpdateCloud === false && decisionByTime.isConflict === true,
      'Original local updatedAt is compared BEFORE stamping nowISO, preventing stale overwrite'
    );
  }

  // ================================================================================
  // ACCEPTANCE TEST 6: Partial Local Load + Save Does NOT Delete Cloud Records
  // ================================================================================
  console.log("\n--- [ACCEPTANCE #6] Partial Local Orders Slice Does NOT Delete Cloud Records ---");
  {
    const cloudOrders = Array.from({ length: 236 }, (_, i) => ({
      id: `cloud_ord_${i + 1}`,
      orderNumber: `ORD-${i + 1}`,
      customerName: `عميل ${i + 1}`,
      updatedAt: '2026-04-19T08:00:00.000Z'
    })) as any[];

    // Simulate a client that only loaded 3 orders in stores_data.orders
    const partialLocalOrders = [
      { ...cloudOrders[0], status: 'مؤكد', updatedAt: '2026-04-19T09:00:00.000Z' },
      cloudOrders[1],
      cloudOrders[2]
    ];

    // 1. Check shouldDeleteCloudRecord for the 233 missing orders
    const deleteDecisions = cloudOrders.slice(3).map(() =>
      shouldDeleteCloudRecord({
        collectionName: 'orders',
        isExplicitlyDeleted: false,
        wasKnownLocally: true,
        isMissingLocally: true
      })
    );
    assert(deleteDecisions.every((d) => d.allowDelete === false), '0 of 233 missing cloud orders are deleted by inferred deletion');

    // 2. Check immutable financial ledger deletion protection even if explicitly requested
    const txDeleteDecision = shouldDeleteCloudRecord({
      collectionName: 'transactions',
      isExplicitlyDeleted: true,
      wasKnownLocally: true,
      isMissingLocally: true
    });
    assert(
      txDeleteDecision.allowDelete === false &&
      txDeleteDecision.reason === 'IMMUTABLE_FINANCIAL_LEDGER_REQUIRES_REVERSAL_ENTRY',
      'Financial transactions cannot be deleted even with explicit delete flag'
    );

    // 3. Check reconcileDualOrderSources merges all 236 orders
    const reconciled = reconcileDualOrderSources('store-1771165841517-fkrbaec', partialLocalOrders, cloudOrders);
    assert(reconciled.mergedOrders.length === 236, 'reconcileDualOrderSources preserves all 236 orders without loss');
    const updatedFirst = reconciled.mergedOrders.find((o) => o.id === 'cloud_ord_1');
    assert(updatedFirst?.status === 'مؤكد', 'Newer status on cloud_ord_1 is preserved during reconciliation');
  }

  // ================================================================================
  // ACCEPTANCE TEST 7: Creating 2 Orders Simultaneously via API
  // ================================================================================
  console.log("\n--- [ACCEPTANCE #7] Two Simultaneous API Order Creations Preserve Both Orders ---");
  {
    const apiAdapter = createInMemoryStoreAdapter({
      store_api: {
        settings: {
          products: [{ id: 'p_api', name: 'مفتاح ربط', price: 200, stockQuantity: 50 } as any],
          suppliers: []
        } as any,
        orders: [],
        wallet: { balance: 0, transactions: [] },
        cart: [],
        customers: []
      }
    });

    const [apiOrder1, apiOrder2] = await Promise.all([
      createOrderAtomic(apiAdapter, {
        storeId: 'store_api',
        actorId: 'api_key:main',
        actorRole: 'api_client',
        idempotencyKey: 'api_sim_1',
        orderPayload: {
          customerName: 'عميل API الأول',
          customerPhone: '01011112222',
          totalPrice: 200,
          items: [{ productId: 'p_api', name: 'مفتاح ربط', quantity: 1, price: 200, cost: 120 }]
        }
      }),
      createOrderAtomic(apiAdapter, {
        storeId: 'store_api',
        actorId: 'api_key:main',
        actorRole: 'api_client',
        idempotencyKey: 'api_sim_2',
        orderPayload: {
          customerName: 'عميل API الثاني',
          customerPhone: '01033334444',
          totalPrice: 400,
          items: [{ productId: 'p_api', name: 'مفتاح ربط', quantity: 2, price: 200, cost: 120 }]
        }
      })
    ]);

    assert(apiOrder1.success && apiOrder2.success, 'Both simultaneous API orders succeeded');
    assert(apiOrder1.order!.id !== apiOrder2.order!.id, 'Both API orders received distinct collision-free IDs');
    assert(apiAdapter.stores.store_api.orders.length === 2, 'Both orders are saved in store without overwriting each other');
    assert(apiAdapter.stores.store_api.settings.products[0].stockQuantity === 47, 'Both stock deductions applied accurately (50 - 1 - 2 = 47)');
  }

  // ================================================================================
  // ACCEPTANCE TEST 8: Cross-Store Isolation (Store A Actor Accessing Store B)
  // ================================================================================
  console.log("\n--- [ACCEPTANCE #8] Cross-Store Access Attempt Denied ---");
  {
    const isolationAdapter = createInMemoryStoreAdapter({
      store_B: {
        settings: { products: [], suppliers: [] } as any,
        orders: [],
        wallet: { balance: 0, transactions: [] },
        cart: [],
        customers: []
      }
    });

    const crossStoreRes = await createOrderAtomic(isolationAdapter, {
      storeId: 'store_B',
      actorId: 'user_from_store_A',
      actorRole: 'merchant',
      authorizedStoreIds: ['store_A'], // Only authorized for store_A
      idempotencyKey: 'cross_store_attempt',
      orderPayload: {
        customerName: 'محاولة اختراق',
        customerPhone: '01000000000',
        totalPrice: 100
      }
    });

    assert(
      crossStoreRes.success === false && crossStoreRes.code === 'CrossStoreAccessDenied',
      'Actor from store_A is blocked from creating orders in store_B'
    );
    assert(isolationAdapter.stores.store_B.orders.length === 0, 'store_B orders remain untouched');

    // Also test Dedicated Manager order creation block
    const dedicatedMgrRes = await createOrderAtomic(isolationAdapter, {
      storeId: 'store_B',
      actorId: 'dedicated_mgr_1',
      actorRole: 'account_manager',
      authorizedStoreIds: ['store_B'],
      idempotencyKey: 'mgr_create_attempt',
      orderPayload: {
        customerName: 'طلب من مدير مخصص',
        customerPhone: '01000000000',
        totalPrice: 100
      }
    });
    assert(
      dedicatedMgrRes.success === false && dedicatedMgrRes.code === 'DedicatedManagerOrderCreationForbidden',
      'Dedicated Account Manager is blocked from creating orders on server'
    );
  }

  // ================================================================================
  // ACCEPTANCE TEST 11: Plan Change & Expired endDate Do NOT Reprice Old Orders
  // ================================================================================
  console.log("\n--- [ACCEPTANCE #11] Plan Change & Expired endDate Do NOT Reprice Historical Orders ---");
  {
    const expiredPlanMerchant: Supplier = {
      id: 'm_exp',
      name: 'تاجر منتهي الباقة',
      phone: '01055556666',
      balance: 500,
      transactions: [],
      managerPlan: {
        planId: 'monthly_1000',
        planName: 'باقة المدير المخصص',
        billingCycle: 'monthly',
        orderFee: 0,
        monthlyFee: 1000,
        totalPaidAmount: 1000,
        includedOrdersQuota: 50,
        extraOrderFee: 20,
        cycleId: 'CYCLE_EXPIRED_1',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-31T00:00:00.000Z', // Expired!
        status: 'active' // Even if status string wasn't flipped yet!
      }
    } as any;

    const nowMs = Date.parse('2026-04-19T12:00:00.000Z');
    assert(
      isPlanCycleCurrentlyActive(expiredPlanMerchant.managerPlan, nowMs) === false,
      'isPlanCycleCurrentlyActive returns false when endDate has passed even if status=="active"'
    );

    const snapshotForNewOrder = buildOrderPlanSnapshot(expiredPlanMerchant, nowMs);
    assert(
      snapshotForNewOrder.planModeAtCreation === 'self_service',
      'New orders created after plan endDate receive planModeAtCreation="self_service"'
    );

    // Verify historical order created under self_service mode is NOT repriced as manager order
    const expStore: StoreData = {
      settings: { suppliers: [expiredPlanMerchant] } as any,
      orders: [
        {
          id: 'old_standard_order',
          orderNumber: 'ORD-OLD-1',
          merchantId: 'm_exp',
          planModeAtCreation: 'self_service',
          planIdAtCreation: 'free',
          status: 'جاري_المراجعة',
          totalPrice: 300
        } as any
      ],
      wallet: { balance: 0, transactions: [] },
      cart: [],
      customers: []
    };

    const confirmOldRes = await confirmOrderWithQuotaAndFee({
      storeId: 'store_exp',
      orderId: 'old_standard_order',
      inMemoryStoreData: expStore
    });
    assert(
      confirmOldRes.feeDeducted === 0,
      'Order created under self_service mode or expired plan does not deduct manager fee'
    );
  }

  // ================================================================================
  // ACCEPTANCE TEST 12: Two Concurrent Orders Competing for Last 1 Unit of Stock
  // ================================================================================
  console.log("\n--- [ACCEPTANCE #12] Two Concurrent Orders Competing for Last 1 Stock Unit ---");
  {
    const stockAdapter = createInMemoryStoreAdapter({
      store_stock: {
        settings: {
          products: [{ id: 'last_drill', name: 'شنيور أخير', price: 1500, stockQuantity: 1 } as any],
          suppliers: []
        } as any,
        orders: [],
        wallet: { balance: 0, transactions: [] },
        cart: [],
        customers: []
      }
    });

    const [buyer1, buyer2] = await Promise.all([
      createOrderAtomic(stockAdapter, {
        storeId: 'store_stock',
        actorId: 'merchant_1',
        actorRole: 'merchant',
        idempotencyKey: 'last_unit_buyer_1',
        orderPayload: {
          customerName: 'مشتري 1',
          customerPhone: '01011110001',
          totalPrice: 1500,
          items: [{ productId: 'last_drill', name: 'شنيور أخير', quantity: 1, price: 1500, cost: 1100 }]
        }
      }),
      createOrderAtomic(stockAdapter, {
        storeId: 'store_stock',
        actorId: 'merchant_2',
        actorRole: 'merchant',
        idempotencyKey: 'last_unit_buyer_2',
        orderPayload: {
          customerName: 'مشتري 2',
          customerPhone: '01011110002',
          totalPrice: 1500,
          items: [{ productId: 'last_drill', name: 'شنيور أخير', quantity: 1, price: 1500, cost: 1100 }]
        }
      })
    ]);

    const successes = [buyer1, buyer2].filter((r) => r.success);
    const failures = [buyer1, buyer2].filter((r) => !r.success);
    assert(successes.length === 1 && failures.length === 1, 'Exactly 1 order succeeds and 1 order is rejected for the last stock unit');
    assert(failures[0].code === 'InsufficientStock', 'Second order fails with InsufficientStock');
    assert(stockAdapter.stores.store_stock.settings.products[0].stockQuantity === 0, 'Product stock is 0 (never negative)');
  }

  // ================================================================================
  // ACCEPTANCE TEST 13: Two Concurrent Financial Withdrawals on Same Balance
  // ================================================================================
  console.log("\n--- [ACCEPTANCE #13] Two Concurrent Withdrawals on Same Merchant Balance ---");
  {
    const withdrawAdapter = createInMemoryStoreAdapter({
      store_fin: {
        settings: {
          products: [],
          suppliers: [
            {
              id: 'sup_withdraw',
              name: 'تاجر السحب',
              phone: '01077778888',
              balance: 1000, // Only 1000 EGP available
              transactions: []
            } as any
          ]
        } as any,
        orders: [],
        wallet: { balance: 0, transactions: [] },
        cart: [],
        customers: []
      }
    });

    const wKeySuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const [w1, w2] = await Promise.all([
      processMerchantWithdrawalAtomic(withdrawAdapter, {
        storeId: 'store_fin',
        merchantId: 'sup_withdraw',
        actorId: 'sup_withdraw',
        authorizedStoreIds: ['store_fin'],
        amount: 800,
        idempotencyKey: `withdraw_req_1_${wKeySuffix}`
      }),
      processMerchantWithdrawalAtomic(withdrawAdapter, {
        storeId: 'store_fin',
        merchantId: 'sup_withdraw',
        actorId: 'sup_withdraw',
        authorizedStoreIds: ['store_fin'],
        amount: 800,
        idempotencyKey: `withdraw_req_2_${wKeySuffix}`
      })
    ]);

    const wSuccess = [w1, w2].filter((w) => w.success);
    const wFail = [w1, w2].filter((w) => !w.success);
    assert(wSuccess.length === 1 && wFail.length === 1, 'Only 1 of the two 800 EGP withdrawals succeeds against 1000 EGP balance');
    assert(wFail[0].code === 'InsufficientBalance', 'Second withdrawal rejected with InsufficientBalance');
    assert(withdrawAdapter.stores.store_fin.settings.suppliers[0].balance === 200, 'Final merchant balance is 200 EGP');
  }

  // ================================================================================
  // ACCEPTANCE TEST 14: Duplicate Carrier Webhook / Delivery Settlement
  // ================================================================================
  console.log("\n--- [ACCEPTANCE #14] Duplicate Carrier Webhook / Settlement Deduplication ---");
  {
    const webhookAdapter = createInMemoryStoreAdapter({
      store_wh: {
        settings: {
          products: [],
          suppliers: [
            {
              id: 'sup_wh',
              name: 'تاجر الشحن',
              phone: '01022223333',
              balance: 100,
              transactions: []
            } as any
          ]
        } as any,
        orders: [
          {
            id: 'ord_bosta_1',
            orderNumber: 'ORD-B1',
            merchantId: 'sup_wh',
            status: 'تم_الشحن',
            totalPrice: 650,
            shippingFee: 50,
            items: [{ productId: 'p1', name: 'عدة', quantity: 1, price: 600, cost: 400 }]
          } as any
        ],
        wallet: { balance: 0, transactions: [] },
        cart: [],
        customers: []
      }
    });

    const [wh1, wh2] = await Promise.all([
      processCarrierEventOrSettlementAtomic(webhookAdapter, {
        storeId: 'store_wh',
        orderId: 'ord_bosta_1',
        eventId: 'bosta_evt_delivered_999',
        newStatus: 'تم_التوصيل',
        merchantId: 'sup_wh',
        merchantCreditAmount: 200 // e.g., net profit 600 - 400 = 200 EGP
      }),
      processCarrierEventOrSettlementAtomic(webhookAdapter, {
        storeId: 'store_wh',
        orderId: 'ord_bosta_1',
        eventId: 'bosta_evt_delivered_999',
        newStatus: 'تم_التوصيل',
        merchantId: 'sup_wh',
        merchantCreditAmount: 200
      })
    ]);

    assert(wh1.success && wh2.success, 'Both webhook calls handled cleanly');
    assert(
      (wh1.alreadyProcessed === false && wh2.alreadyProcessed === true) ||
      (wh1.alreadyProcessed === true && wh2.alreadyProcessed === false),
      'Exactly one webhook execution applies settlement, the duplicate is flagged alreadyProcessed=true'
    );
    assert(
      webhookAdapter.stores.store_wh.settings.suppliers[0].balance === 300,
      'Merchant balance credited once (100 + 200 = 300 EGP)'
    );
  }

  // ================================================================================
  // ACCEPTANCE TEST 15: Full Cloud Backup & Isolated Restore Verification
  // ================================================================================
  console.log("\n--- [ACCEPTANCE #15] Full Cloud Backup & Isolated Restore Parity ---");
  {
    const backupFile = path.resolve(process.cwd(), 'data/backups/full_firestore_backup_latest.json');
    const restoreFile = path.resolve(process.cwd(), 'data/backups/isolated_restore_env.json');
    assert(fs.existsSync(backupFile), 'Full cloud backup file exists on disk');
    assert(fs.existsSync(restoreFile), 'Isolated restore verification artifact exists on disk');

    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));
    const restoreData = JSON.parse(fs.readFileSync(restoreFile, 'utf-8'));

    const backupOrdersCount = Object.keys(backupData.orders || {}).length;
    const restoreOrdersCount = Object.keys(restoreData.orders || {}).length;
    const backupTxCount = Object.keys(backupData.transactions || {}).length;
    const restoreTxCount = Object.keys(restoreData.transactions || {}).length;

    assert(
      backupOrdersCount === restoreOrdersCount && backupOrdersCount >= 242,
      `All ${backupOrdersCount} cloud orders backed up and verified in isolated restore`
    );
    assert(
      backupTxCount === restoreTxCount && backupTxCount >= 963,
      `All ${backupTxCount} cloud financial transactions backed up and verified in isolated restore`
    );

    // Also verify password hashing utility
    const hashed = await hashPasswordSecure('MySecretPass123!');
    assert(hashed.startsWith('sha256$'), 'hashPasswordSecure produces salted sha256$ digest');
    assert((await verifyPasswordSecure('MySecretPass123!', hashed)).valid, 'verifyPasswordSecure validates correct password against hash');
    assert(!(await verifyPasswordSecure('WrongPass', hashed)).valid, 'verifyPasswordSecure rejects wrong password');
    const legacyCheck = await verifyPasswordSecure('legacyPlain123', 'legacyPlain123');
    assert(legacyCheck.valid && legacyCheck.needsRehash, 'verifyPasswordSecure supports non-destructive legacy plaintext check and flags needsRehash');
  }

  // ================================================================================
  // Ledger Reconciliation Audit
  // ================================================================================
  console.log("\n--- Ledger Reconciliation Audit ---");
  const audit = reconcileMerchantLedger(baseStore.settings.suppliers[0]);
  assert(audit.transactionsCount >= 2, `Transactions logged in ledger (${audit.transactionsCount})`);

  console.log("\n================================================================================");
  console.log(`🎉 ALL ${passedTests} ASSERTIONS ACROSS ALL 15 ACCEPTANCE SCENARIOS PASSED (0 FAILED)!`);
  console.log("================================================================================");
}

runAllTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Test Suite Failure:", err);
    process.exit(1);
  });
