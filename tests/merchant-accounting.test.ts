import assert from 'node:assert/strict';
import {
  calculateMerchantSettlement,
  canTransitionSettlement,
  createPendingSettlement,
  getExplicitMerchantIds,
  getMerchantItems,
  settlementKey,
  calculateMerchantBalance,
  canPaySettlement
} from '../utils/merchantAccounting';
import { getProductsForMerchant, isMerchantOrder, migrateLegacyProductMerchantLinks } from '../utils/merchantProducts';

const baseOrder: any = {
  id: 'order-1', orderNumber: '1001', date: '2026-10-27', status: 'تم_التوصيل', totalPrice: 1000,
  items: [
    { productId: 'a', name: 'A', merchantId: 'm1', quantity: 1, price: 400, cost: 200 },
    { productId: 'b', name: 'B', merchantId: 'm2', quantity: 1, price: 300, cost: 100 },
    { productId: 'c', name: 'C', ownerType: 'store', quantity: 1, price: 300, cost: 120 }
  ]
};

assert.deepEqual(getExplicitMerchantIds(baseOrder).sort(), ['m1', 'm2']);
assert.equal(getMerchantItems(baseOrder, 'm1').length, 1);
assert.equal(getMerchantItems(baseOrder, 'm2').length, 1);
assert.equal(isMerchantOrder({ items: [{ name: 'legacy', merchantName: 'Same Name', quantity: 1 }] }), false);

const m1 = calculateMerchantSettlement(baseOrder, 'm1', { shippingFee: 100, codFee: 20, marketingFee: 30, serviceFee: 50 });
const m2 = calculateMerchantSettlement(baseOrder, 'm2', { shippingFee: 100, codFee: 20, marketingFee: 30, serviceFee: 50 });
assert.equal(m1.complete, true);
assert.equal(m1.totals.goodsCost, 200);
assert.equal(m2.totals.goodsCost, 100);
assert.ok(m1.totals.netPayout >= 0 && m2.totals.netPayout >= 0);
assert.ok(m1.totals.netPayout + m2.totals.netPayout <= 1000);
assert.equal(calculateMerchantSettlement(baseOrder, 'unknown').complete, false);

const pending = createPendingSettlement({ storeId: 'store-1', order: baseOrder, merchantId: 'm1', calculation: m1 });
const pendingAgain = createPendingSettlement({ storeId: 'store-1', order: baseOrder, merchantId: 'm1', calculation: m1 });
assert.equal(pending.idempotencyKey, settlementKey('store-1', 'order-1', 'm1'));
assert.equal(pending.id, pendingAgain.id);
assert.equal(pending.status, 'pending');
assert.equal((pending as any).calculationComplete, true);

assert.equal(canTransitionSettlement('pending', 'approved'), true);
assert.equal(canTransitionSettlement('approved', 'paid'), true);
assert.equal(canTransitionSettlement('paid', 'approved'), false);
assert.equal(canTransitionSettlement('cancelled', 'approved'), false);

const shared = getProductsForMerchant([{ id: 'p', ownerType: 'shared', merchantIds: ['m1', 'm2'], stockQuantity: 50, merchantAllocations: [{ merchantId: 'm1', stock: 3 }] }], 'm2');
assert.equal((shared[0] as any).stock, 0);
const explicit = migrateLegacyProductMerchantLinks([{ id: 'legacy', merchantName: 'Same Name' }], [{ id: 'm1', name: 'Same Name' }], []);
assert.equal(explicit.migratedCount, 0);
assert.equal((explicit.products[0] as any).merchantId, undefined);

assert.equal(calculateMerchantBalance('m1', [{ merchantId: 'm1', status: 'approved', netPayoutToMerchant: 300 }], []), 300);
assert.equal(calculateMerchantBalance('m1', [{ merchantId: 'm1', status: 'approved', netPayoutToMerchant: 300 }], [{ id: 'w', merchantId: 'm1', type: 'withdrawal', amount: -100, balanceAfter: 0, date: '', notes: '' } as any]), 200);
assert.equal(canPaySettlement({ status: 'approved', calculationComplete: true }, { accounts: [{ id: 'cash', name: 'Cash', type: 'safe', balance: 500, currency: 'EGP' }], transactions: [] }, 'cash', 300), true);
assert.equal(canPaySettlement({ status: 'pending', calculationComplete: true }, { accounts: [], transactions: [] }, 'cash', 1), false);

console.log('merchant-accounting tests passed');
