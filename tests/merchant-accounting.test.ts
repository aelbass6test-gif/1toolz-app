import assert from 'node:assert/strict';
import {
  calculateMerchantSettlement,
  canTransitionSettlement,
  createPendingSettlement,
  getExplicitMerchantIds,
  getMerchantItems,
  settlementKey,
  calculateMerchantBalance,
  canPaySettlement,
  calculateMerchantOpeningBalance,
  ensureOrderMerchantSettlements,
  getMerchantOrderGroups,
  splitSettlementByOrder,
  upsertOrderSettlements,
  cancelUnpaidOrderSettlements
} from '../utils/merchantAccounting';
import { getProductsForMerchant, getProductsNeedingMerchantReview, getStoreOwnedOrders, isMerchantOrder, migrateLegacyProductMerchantLinks } from '../utils/merchantProducts';

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

const shared = getProductsForMerchant([{ id: 'p', ownerType: 'shared', merchantIds: ['m1', 'm2'], stockQuantity: 50, costPrice: 12, warehouseStock: { w1: 50 }, merchantAllocations: [{ merchantId: 'm1', stock: 3, costPrice: 4 }] }], 'm2');
assert.equal((shared[0] as any).stock, null);
assert.equal((shared[0] as any).stockQuantity, null);
assert.equal((shared[0] as any).unlimitedStock, true);
assert.notEqual((shared[0] as any).stock, 50, 'merchant must not see store-level stock');
assert.equal((shared[0] as any).costPrice, 0);
assert.equal((shared[0] as any).warehouseStock, undefined);
assert.deepEqual((shared[0] as any).merchantIds, ['m2']);
assert.deepEqual((shared[0] as any).merchantAllocations, []);
const finiteShared = getProductsForMerchant([{ id: 'p2', ownerType: 'shared', merchantIds: ['m1'], stockQuantity: 50, merchantAllocations: [{ merchantId: 'm1', stock: 3 }] }], 'm1');
assert.equal((finiteShared[0] as any).stock, 3);
assert.equal((finiteShared[0] as any).unlimitedStock, false);
assert.equal(getProductsForMerchant([{ id: 'store-only', ownerType: 'store', stockQuantity: 50, merchantIds: ['m1'] }], 'm1').length, 1);
const explicit = migrateLegacyProductMerchantLinks([{ id: 'legacy', merchantName: 'Same Name' }], [{ id: 'm1', name: 'Same Name' }], []);
assert.equal(explicit.migratedCount, 0);
assert.equal((explicit.products[0] as any).merchantId, undefined);

assert.equal(calculateMerchantBalance('m1', [{ merchantId: 'm1', status: 'approved', netPayoutToMerchant: 300 }], []), 300);
assert.equal(calculateMerchantBalance('m1', [{ merchantId: 'm1', status: 'approved', netPayoutToMerchant: 300 }], [{ id: 'w', merchantId: 'm1', type: 'withdrawal', amount: -100, balanceAfter: 0, date: '', notes: '' } as any]), 200);
assert.equal(canPaySettlement({ status: 'approved', calculationComplete: true }, { accounts: [{ id: 'cash', name: 'Cash', type: 'safe', balance: 500, currency: 'EGP' }], transactions: [] }, 'cash', 300), true);
assert.equal(canPaySettlement({ status: 'pending', calculationComplete: true }, { accounts: [], transactions: [] }, 'cash', 1), false);

// Same-name agents never cause a name-only product link and remain visible for admin review.
const sameNameAgents = [{ id: 'm1', name: 'Same Name' }, { id: 'm2', name: ' same name ' }];
const nameOnlyProduct = [{ id: 'legacy-product', name: 'Legacy', merchantName: 'Same Name' }];
const safeMigration = migrateLegacyProductMerchantLinks(nameOnlyProduct, sameNameAgents, []);
assert.equal(safeMigration.products[0].merchantId, undefined);
assert.equal(getProductsNeedingMerchantReview(safeMigration.products, sameNameAgents, []).length, 1);
assert.equal(migrateLegacyProductMerchantLinks(safeMigration.products, sameNameAgents, []).changed, false);

// Single merchant, store-only and mixed orders remain separated by explicit IDs at item level.
const oneAgentOrder: any = { id: 'single', merchantId: 'm1', items: [{ merchantId: 'm1', quantity: 1, cost: 10 }] };
const storeOnlyOrder: any = { id: 'store', items: [{ ownerType: 'store', quantity: 1, cost: 5 }] };
assert.deepEqual([...getMerchantOrderGroups(oneAgentOrder).keys()], ['m1']);
assert.equal(getMerchantOrderGroups(storeOnlyOrder).size, 0);
assert.deepEqual(getStoreOwnedOrders([storeOnlyOrder, oneAgentOrder]).map(row => row.id), ['store']);
assert.deepEqual([...getMerchantOrderGroups(baseOrder).keys()].sort(), ['m1', 'm2']);

// Order/merchant placeholders are idempotent; final calculated rows replace only their exact key.
const placeholders = ensureOrderMerchantSettlements([], 'store-1', baseOrder, '2026-10-27T00:00:00.000Z');
assert.equal(placeholders.length, 2);
assert.equal(ensureOrderMerchantSettlements(placeholders, 'store-1', baseOrder).length, 2);
assert.ok(placeholders.every(row => row.status === 'pending' && row.calculationComplete === false));
const splitBatch = splitSettlementByOrder({
  ...pending, id: 'batch-1', settlementNumber: 'B-1', status: 'draft', merchantId: 'm1',
  orderSnapshots: [{ orderId: 'order-1', date: '2026-10-27', status: 'تم_التوصيل', collectedAmount: 400, merchantGoodsCost: 200, netMerchantAmount: 300 }]
}, 'store-1');
assert.equal(splitBatch.length, 1);
assert.equal(splitBatch[0].orderId, 'order-1');
assert.equal(splitBatch[0].status, 'pending');
assert.equal(splitBatch[0].calculationComplete, true);
assert.equal(upsertOrderSettlements(placeholders, splitBatch).filter(row => row.idempotencyKey === splitBatch[0].idempotencyKey).length, 1);

// Returns cancel pending/approved rows without deleting them; paid rows are immutable.
const returnRows = cancelUnpaidOrderSettlements([
  { ...splitBatch[0], status: 'approved' },
  { ...splitBatch[0], id: 'paid-row', status: 'paid' }
], 'order-1', '2026-10-28T00:00:00.000Z');
assert.equal(returnRows.length, 2);
assert.equal(returnRows[0].status, 'cancelled');
assert.equal(returnRows[1].status, 'paid');
assert.equal(calculateMerchantBalance('m1', [returnRows[0]], [
  { id: 'return-shipping', merchantId: 'm1', type: 'order_returned', amount: -5 } as any
]), -5);

// Preserve legacy wallet balance as an opening amount, then derive later approved credits and withdrawals.
const opening = calculateMerchantOpeningBalance(1000, [{ merchantId: 'm1', status: 'paid', netPayoutToMerchant: 300 } as any], [
  { id: 'old-withdrawal', merchantId: 'm1', type: 'withdrawal', amount: -100 } as any
], 'm1');
assert.equal(opening, 800);
assert.equal(calculateMerchantBalance('m1', [{ merchantId: 'm1', status: 'paid', netPayoutToMerchant: 300 } as any], [
  { id: 'old-withdrawal', merchantId: 'm1', type: 'withdrawal', amount: -100 } as any
], opening), 1000);

console.log('merchant-accounting tests passed');
