export const STORE_MEMBERSHIP_ROLES = ['owner', 'manager', 'staff'] as const;
export type StoreMembershipRole = (typeof STORE_MEMBERSHIP_ROLES)[number];

export interface StoreMembership {
  user_id: string;
  store_id: string;
  role: StoreMembershipRole;
  created_at: string;
}

type MembershipRow = {
  user_id?: unknown;
  store_id?: unknown;
  role?: unknown;
  created_at?: unknown;
};

export function isStoreMembershipRole(value: unknown): value is StoreMembershipRole {
  return typeof value === 'string' &&
    (STORE_MEMBERSHIP_ROLES as readonly string[]).includes(value);
}

/**
 * Validate rows against the authenticated UUID before exposing store choices.
 * This is a client-side convenience check only; RLS remains the authorization
 * boundary for every actual database read/write.
 */
export function normalizeStoreMembershipRows(
  rows: unknown,
  authenticatedUserId: string
): StoreMembership[] {
  const expectedUserId = authenticatedUserId.trim();
  if (!expectedUserId) {
    throw new Error('لا توجد جلسة مستخدم موثقة.');
  }
  if (!Array.isArray(rows)) {
    throw new Error('استجابة عضويات المتاجر غير صالحة.');
  }

  const seenStoreIds = new Set<string>();
  const memberships: StoreMembership[] = [];

  for (const value of rows as MembershipRow[]) {
    if (!value || typeof value !== 'object') {
      throw new Error('سجل عضوية متجر غير صالح.');
    }

    const userId = typeof value.user_id === 'string' ? value.user_id : '';
    const storeId = typeof value.store_id === 'string' ? value.store_id.trim() : '';
    const role = value.role;
    const createdAt = typeof value.created_at === 'string' ? value.created_at : '';

    if (userId !== expectedUserId) {
      throw new Error('رفض سجل عضوية لا يخص المستخدم الحالي.');
    }
    if (!storeId || !createdAt) {
      throw new Error('سجل عضوية المتجر ينقصه معرّف أو تاريخ صالح.');
    }
    if (!isStoreMembershipRole(role)) {
      throw new Error('دور عضوية المتجر غير معروف؛ تم إيقاف تسجيل الدخول الآمن.');
    }
    if (seenStoreIds.has(storeId)) {
      throw new Error('تم العثور على عضويات مكررة للمتجر نفسه.');
    }

    seenStoreIds.add(storeId);
    memberships.push({
      user_id: userId,
      store_id: storeId,
      role,
      created_at: createdAt
    });
  }

  return memberships;
}
