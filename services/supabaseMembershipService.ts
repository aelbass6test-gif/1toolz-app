import type { SupabaseClient } from '@supabase/supabase-js';
import { getAuthSupabaseClient, getSupabaseAuthUser } from './supabaseAuthService';

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

/**
 * Validate rows against the authenticated UUID before exposing store choices.
 * This is a client-side convenience check only; RLS remains the authorization
 * boundary for every actual database read/write.
 */
export function normalizeStoreMembershipRows(
  rows: unknown,
  authenticatedUserId: string
): StoreMembership[] {
  if (!authenticatedUserId.trim()) {
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
    const role = typeof value.role === 'string' ? value.role : '';
    const createdAt = typeof value.created_at === 'string' ? value.created_at : '';

    if (userId !== authenticatedUserId) {
      throw new Error('رفض سجل عضوية لا يخص المستخدم الحالي.');
    }
    if (!storeId || !createdAt) {
      throw new Error('سجل عضوية المتجر ينقصه معرّف أو تاريخ صالح.');
    }
    if (!(STORE_MEMBERSHIP_ROLES as readonly string[]).includes(role)) {
      throw new Error('دور عضوية المتجر غير معروف؛ تم إيقاف تسجيل الدخول الآمن.');
    }
    if (seenStoreIds.has(storeId)) {
      throw new Error('تم العثور على عضويات مكررة للمتجر نفسه.');
    }

    seenStoreIds.add(storeId);
    memberships.push({
      user_id: userId,
      store_id: storeId,
      role: role as StoreMembershipRole,
      created_at: createdAt
    });
  }

  return memberships;
}

/**
 * Resolve only memberships for the verified Supabase Auth user.
 * The user id is never accepted from a caller or local storage.
 */
export async function getCurrentUserStoreMemberships(): Promise<StoreMembership[]> {
  const user = await getSupabaseAuthUser();
  if (!user || user.is_anonymous) {
    throw new Error('سجّل الدخول بحساب موثق أولاً.');
  }

  const client = getAuthSupabaseClient();
  const { data, error } = await client
    .from('store_memberships')
    .select('user_id, store_id, role, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[SUPABASE-MEMBERSHIP] Failed to load current-user memberships:', {
      code: error.code,
      status: error.status
    });
    throw new Error('تعذر تحميل صلاحيات المتاجر. يرجى المحاولة مرة أخرى.');
  }

  return normalizeStoreMembershipRows(data, user.id);
}

/**
 * Find the current user's membership for one requested store.
 * This helper does not grant access; the database RLS policy must still verify
 * the caller for every table operation.
 */
export async function getCurrentUserStoreMembership(
  requestedStoreId: string
): Promise<StoreMembership | null> {
  const storeId = requestedStoreId.trim();
  if (!storeId) return null;

  const memberships = await getCurrentUserStoreMemberships();
  return memberships.find(membership => membership.store_id === storeId) || null;
}

/** Exported for isolated tests without any live Supabase connection. */
export function isStoreMembershipRole(value: unknown): value is StoreMembershipRole {
  return typeof value === 'string' &&
    (STORE_MEMBERSHIP_ROLES as readonly string[]).includes(value);
}

/** Keep the Supabase client type referenced to catch incompatible SDK updates. */
export type MembershipSupabaseClient = SupabaseClient;
