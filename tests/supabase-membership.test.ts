import assert from 'node:assert/strict';
import {
  isStoreMembershipRole,
  normalizeStoreMembershipRows
} from '../utils/supabaseMembership';

const userId = '11111111-2222-4333-8444-555555555555';

const validRows = [
  { user_id: userId, store_id: 'store-a', role: 'owner', created_at: '2026-01-01T00:00:00.000Z' },
  { user_id: userId, store_id: 'store-b', role: 'manager', created_at: '2026-01-02T00:00:00.000Z' },
  { user_id: userId, store_id: 'store-c', role: 'staff', created_at: '2026-01-03T00:00:00.000Z' }
];

const normalized = normalizeStoreMembershipRows(validRows, userId);
assert.equal(normalized.length, 3);
assert.deepEqual(normalized.map(item => item.role), ['owner', 'manager', 'staff']);
assert.deepEqual(normalized.map(item => item.store_id), ['store-a', 'store-b', 'store-c']);

assert.equal(isStoreMembershipRole('owner'), true);
assert.equal(isStoreMembershipRole('manager'), true);
assert.equal(isStoreMembershipRole('staff'), true);
assert.equal(isStoreMembershipRole('admin'), false);
assert.equal(isStoreMembershipRole(null), false);

assert.throws(
  () => normalizeStoreMembershipRows([{ ...validRows[0], user_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' }], userId),
  /لا يخص المستخدم الحالي/
);
assert.throws(
  () => normalizeStoreMembershipRows([{ ...validRows[0], role: 'platform_admin' }], userId),
  /دور عضوية المتجر غير معروف/
);
assert.throws(
  () => normalizeStoreMembershipRows([{ ...validRows[0], store_id: '   ' }], userId),
  /ينقصه معرّف/
);
assert.throws(
  () => normalizeStoreMembershipRows([validRows[0], validRows[0]], userId),
  /مكررة/
);
assert.throws(() => normalizeStoreMembershipRows(null, userId), /غير صالحة/);
assert.throws(() => normalizeStoreMembershipRows([], ''), /جلسة مستخدم/);

console.log('supabase-membership tests passed');
