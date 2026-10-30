import { getAuthSupabaseClient, getSupabaseAuthUser } from './supabaseAuthService';
import {
  normalizeStoreMembershipRows,
  type StoreMembership
} from '../utils/supabaseMembership';

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
    // Avoid logging profile, token, or row contents.
    console.error('[SUPABASE-MEMBERSHIP] Failed to load current-user memberships:', {
      code: error.code
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
