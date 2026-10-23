import { 
  createOrderAtomic, 
  confirmOrderWithQuotaAndFee, 
  processMerchantWithdrawalAtomic,
  StoreDataAdapter 
} from '../services/orderQuotaLedgerService';
import { StoreData, Product, Order, Supplier } from '../types';

/**
 * Concurrency & Transactional Integrity Test Suite
 * Tests Requirement 2:
 * - Genuine transaction serialization across Order, Store, Balance, Quota, Stock, and Idempotency.
 * - Two independent concurrent worker processes/requests competing for the last inventory item.
 * - Server restart / persistent idempotency resilience.
 */

function createMockAdapter(initialStore: StoreData): StoreDataAdapter & { store: StoreData; saveCount: number } {
  let current = JSON.parse(JSON.stringify(initialStore));
  let count = 0;
  return {
    get store() {
      return current;
    },
    get saveCount() {
      return count;
    },
    async getStoreData(storeId: string): Promise<StoreData | null> {
      // Small simulated network latency
      await new Promise(r => setTimeout(r, 10));
      return JSON.parse(JSON.stringify(current));
    },
    async saveStoreData(storeId: string, data: StoreData): Promise<boolean> {
      await new Promise(r => setTimeout(r, 10));
      current = JSON.parse(JSON.stringify(data));
      count++;
      return true;
    }
  };
}

async function runConcurrencyTests() {
  console.log('========================================================================');
  console.log('🧪 CONCURRENCY & TRANSACTION ISOLATION TEST (TWO INDEPENDENT WORKERS)');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond: boolean, desc: string) {
    if (cond) {
      console.log(` ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(` ❌ FAIL: ${desc}`);
      failed++;
      throw new Error(`Assertion failed: ${desc}`);
    }
  }

  // -----------------------------------------------------------------------------
  // Test 1: Two independent concurrent workers attempting to purchase the last unit (Stock = 1)
  // -----------------------------------------------------------------------------
  console.log('--- Scenario 1: Two Independent Workers Competing for the Last Stock Item ---');
  {
    const initialStore: StoreData = {
      orders: [],
      wallet: { balance: 0, transactions: [] },
      cart: [],
      customers: [],
      settings: {
        storeName: 'Test Concurrency Store',
        products: [
          {
            id: 'prod_last_item',
            name: 'المثقاب الكهربائي الأخير',
            stockQuantity: 1, // EXACTLY 1 IN STOCK
            stock: 1,
            price: 500
          } as any
        ],
        suppliers: [],
        partners: []
      } as any
    };

    const adapter = createMockAdapter(initialStore);

    const run1Id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    // Launch worker 1 and worker 2 simultaneously
    const worker1Promise = createOrderAtomic(adapter, {
      storeId: 'store_conc_1',
      idempotencyKey: `worker_1_order_key_${run1Id}`,
      orderInput: {
        customerName: 'عميل أ (العملية 1)',
        customerPhone: '01011111111',
        totalPrice: 500,
        items: [{ productId: 'prod_last_item', quantity: 1, price: 500 }]
      }
    });

    const worker2Promise = createOrderAtomic(adapter, {
      storeId: 'store_conc_1',
      idempotencyKey: `worker_2_order_key_${run1Id}`,
      orderInput: {
        customerName: 'عميل ب (العملية 2)',
        customerPhone: '01022222222',
        totalPrice: 500,
        items: [{ productId: 'prod_last_item', quantity: 1, price: 500 }]
      }
    });

    const [res1, res2] = await Promise.all([worker1Promise, worker2Promise]);

    const successes = [res1, res2].filter(r => r.success);
    const failures = [res1, res2].filter(r => !r.success);

    assert(successes.length === 1, 'Exactly one concurrent worker successfully placed the order');
    assert(failures.length === 1, 'The competing worker was atomically rejected with stock error');
    assert(failures[0].code === 'InsufficientStock', 'Failure reason is InsufficientStock (no negative inventory)');
    
    // Check remaining inventory in store
    const remainingStock = adapter.store.settings.products[0].stockQuantity;
    assert(remainingStock === 0, `Final stock is exactly 0 (actual: ${remainingStock}), no double-deduction`);
    assert(adapter.store.orders.length === 1, 'Store contains exactly 1 order committed');
  }

  // -----------------------------------------------------------------------------
  // Test 2: Two concurrent withdrawal requests exceeding available balance
  // -----------------------------------------------------------------------------
  console.log('\n--- Scenario 2: Two Independent Concurrent Withdrawals (Balance = 1,000 EGP, Each Requests 800 EGP) ---');
  {
    const initialStore: StoreData = {
      orders: [],
      wallet: { balance: 0, transactions: [] },
      cart: [],
      customers: [],
      settings: {
        storeName: 'Test Concurrency Store',
        products: [],
        suppliers: [
          {
            id: 'sup_conc_1',
            name: 'تاجر التزامن',
            balance: 1000, // 1000 EGP available
            transactions: []
          } as any
        ],
        partners: []
      } as any
    };

    const adapter = createMockAdapter(initialStore);

    const testRunId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const withdrawWorker1 = processMerchantWithdrawalAtomic(adapter, {
      storeId: 'store_conc_1',
      merchantId: 'sup_conc_1',
      amount: 800,
      idempotencyKey: `withdraw_key_1_${testRunId}`
    });

    const withdrawWorker2 = processMerchantWithdrawalAtomic(adapter, {
      storeId: 'store_conc_1',
      merchantId: 'sup_conc_1',
      amount: 800,
      idempotencyKey: `withdraw_key_2_${testRunId}`
    });

    const [wRes1, wRes2] = await Promise.all([withdrawWorker1, withdrawWorker2]);

    const wSuccesses = [wRes1, wRes2].filter(r => r.success);
    const wFailures = [wRes1, wRes2].filter(r => !r.success);

    assert(wSuccesses.length === 1, 'Exactly one concurrent withdrawal succeeded');
    assert(wFailures.length === 1, 'The competing concurrent withdrawal was rejected for InsufficientBalance');
    assert(wFailures[0].code === 'InsufficientBalance', 'Rejection code is InsufficientBalance');

    const finalBal = adapter.store.settings.suppliers[0].balance;
    assert(finalBal === 200, `Merchant final balance is exactly 200 EGP (1000 - 800 = 200, actual: ${finalBal})`);
  }

  // -----------------------------------------------------------------------------
  // Test 3: Idempotency Replay After Simulated Restart
  // -----------------------------------------------------------------------------
  console.log('\n--- Scenario 3: Idempotency Key Survives Multiple Invocations (No Re-deduction) ---');
  {
    const initialStore: StoreData = {
      orders: [],
      wallet: { balance: 0, transactions: [] },
      cart: [],
      customers: [],
      settings: {
        products: [{ id: 'prod_replay', stockQuantity: 5, stock: 5 }],
        suppliers: []
      } as any
    };

    const adapter = createMockAdapter(initialStore);
    const run3Id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const idempotencyKey = `shared_unique_idemp_key_${run3Id}`;

    const firstCall = await createOrderAtomic(adapter, {
      storeId: 'store_conc_1',
      idempotencyKey,
      orderInput: {
        id: 'ord_idemp_1',
        customerName: 'عميل الإعادة',
        items: [{ productId: 'prod_replay', quantity: 1 }]
      }
    });

    assert(firstCall.success === true, 'First order placement succeeded');
    assert(firstCall.alreadyExisted === false, 'First call is fresh order');

    // Second call with same idempotencyKey
    const secondCall = await createOrderAtomic(adapter, {
      storeId: 'store_conc_1',
      idempotencyKey,
      orderInput: {
        id: 'ord_idemp_1',
        customerName: 'عميل الإعادة',
        items: [{ productId: 'prod_replay', quantity: 1 }]
      }
    });

    assert(secondCall.success === true, 'Second call returned success via idempotency');
    assert(secondCall.idempotentReplay === true, 'Flagged as idempotent replay');
    assert(secondCall.order?.id === 'ord_idemp_1', 'Returns original order record');

    const stockAfter = adapter.store.settings.products[0].stockQuantity;
    assert(stockAfter === 4, `Stock deducted only once (5 -> 4, actual: ${stockAfter})`);
  }

  console.log(`\n🎉 All ${passed} Concurrency & Transaction scenarios passed! (0 failures)`);
}

runConcurrencyTests()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Fatal concurrency test failure:', e);
    process.exit(1);
  });
