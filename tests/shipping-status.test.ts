import assert from 'node:assert/strict';
import {
  appendShippingTimeline,
  buildEventKey,
  mapBostaStatus,
  mapTurboStatus,
  shouldApplyShippingUpdate,
} from '../utils/shippingStatus';

const baseUpdate = {
  carrier: 'bosta',
  externalStatus: 'Delivered',
  externalCode: 45,
  internalStatus: mapBostaStatus('Delivered', 45),
  eventAt: '2026-09-09T10:00:00.000Z',
  receivedAt: '2026-09-09T10:01:00.000Z',
  trackingNumber: 'B-123',
  externalId: 'delivery-123',
  source: 'webhook' as const,
};

assert.equal(mapBostaStatus('Delivered', 45), 'تم_توصيلها');
assert.equal(mapBostaStatus('In Transit', 40), 'تم_الارسال');
assert.equal(mapBostaStatus('Returned', 46), 'مرتجع');
assert.equal(mapTurboStatus(3, 'Delivered'), 'تم_توصيلها');
assert.equal(mapTurboStatus(6, 'In transit'), 'قيد_الشحن');
assert.equal(mapTurboStatus(10, 'Failed'), 'فشل_التوصيل');

const turboReturnFixture = {
  order_number: 751123,
  status: 5,
  order_price: 7525,
  order_type: 2,
  return_reason: 'Customer Refused',
  delay_reason: 'Mobile Closed',
  mission_code: 123456,
  is_order: 0,
  remote_order_id: '11223344',
  return_status: 0,
  captain_name: 'Mohamed Ahmed',
  captain_number1: '01000000000',
  captain_number2: '01100000000',
};
assert.equal(mapTurboStatus(turboReturnFixture.status), 'مرتجع');
assert.equal(turboReturnFixture.return_reason, 'Customer Refused');
assert.equal(turboReturnFixture.remote_order_id, '11223344');

const eventKey = buildEventKey(baseUpdate);
assert.equal(shouldApplyShippingUpdate({}, baseUpdate, eventKey), true);
assert.equal(shouldApplyShippingUpdate({ lastShippingEventKey: eventKey }, baseUpdate, eventKey), false);
assert.equal(
  shouldApplyShippingUpdate({ lastShippingEventAt: '2026-09-09T11:00:00.000Z' }, baseUpdate, eventKey),
  false,
);
assert.equal(
  shouldApplyShippingUpdate({ lastShippingEventAt: '2026-09-09T09:00:00.000Z' }, baseUpdate, eventKey),
  true,
);

const firstTimeline = appendShippingTimeline({}, baseUpdate, eventKey);
assert.equal(firstTimeline.length, 1);
assert.equal(appendShippingTimeline({ shipmentTimeline: firstTimeline }, baseUpdate, eventKey).length, 1);
assert.equal(
  appendShippingTimeline(
    { shipmentTimeline: firstTimeline },
    { ...baseUpdate, externalStatus: 'Out for delivery', externalCode: 40 },
    buildEventKey({ ...baseUpdate, externalStatus: 'Out for delivery', externalCode: 40 }),
  ).length,
  2,
);

console.log('shipping-status tests: OK');
