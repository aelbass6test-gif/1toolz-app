import assert from 'node:assert/strict';
import { createCustodyLedgerDetails, getCustodyLedgerDetails, getCustodySourceKey, hasMatchingCustodySource } from '../utils/custodyLedger';

const advance = {
  id: 'legacy-handover-1',
  notes: 'عربون / دفع مقدم للطلب #42',
  isVirtual: false
};

assert.equal(getCustodySourceKey({ orderId: 'order-42', orderNumber: '42' }), 'order:order-42');
assert.equal(getCustodySourceKey(advance), 'order-number:42');
assert.equal(
  hasMatchingCustodySource([advance], { orderId: 'different-id', orderNumber: '42', kind: 'advance' }),
  true
);
assert.equal(
  hasMatchingCustodySource([advance], { orderId: 'different-id', orderNumber: '42', kind: 'pos_collection' }),
  false
);
assert.equal(
  hasMatchingCustodySource([{ orderId: 'order-42', notes: 'مبيعات كاشير - طلب #42' }], { orderId: 'order-42', orderNumber: '42', kind: 'pos_collection' }),
  true
);

const details = createCustodyLedgerDetails({
  sourceType: 'manual_holder_transfer',
  sourceId: 'HND-1',
  performedByUserId: 'admin',
  performedByUserName: 'المدير',
  balanceBefore: 500,
  balanceAfter: 350,
  balances: [{ holderId: 'u1', holderName: 'موظف', before: 500, after: 350, direction: 'out' }]
});
assert.equal(details.schemaVersion, 1);
assert.equal(getCustodyLedgerDetails({ details })?.balanceAfter, 350);
assert.equal(getCustodyLedgerDetails({ details: JSON.stringify(details) })?.sourceId, 'HND-1');

console.log('custody-ledger tests passed');
