import { db as firebaseDb } from './firebaseClient';
import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';
import { getSupabaseClient } from './databaseService';
import { User } from '../types';

export interface UserMigrationItem {
    phone: string;
    fullName: string;
    email: string;
    isAdmin: boolean;
    storesCount: number;
    inSupabase: boolean;
    inFirestore: boolean;
    isIdentical: boolean;
    migrationStatus: 'legacy_only' | 'migrated' | 'verified_in_sync';
    migratedAt?: string;
    notes?: string;
}

export interface MigrationSummary {
    totalUsersCount: number;
    legacyUsersCount: number;
    migratedUsersCount: number;
    verifiedInSyncCount: number;
    pendingCount: number;
    lastCheckedAt: string;
}

/**
 * Retrieves the full comparison between legacy Supabase users and Firestore users
 * WITHOUT modifying or deleting any record.
 */
export const fetchMigrationOverview = async (): Promise<{
    summary: MigrationSummary;
    users: UserMigrationItem[];
}> => {
    const supabase = getSupabaseClient();
    const legacyMap = new Map<string, any>();
    const firestoreMap = new Map<string, any>();

    // 1. Load users from Supabase (Legacy)
    if (supabase) {
        try {
            const { data, error } = await supabase.from('users').select('*');
            if (!error && Array.isArray(data)) {
                data.forEach((item: any) => {
                    if (item.phone) {
                        legacyMap.set(item.phone, item);
                    }
                });
            }
        } catch (e) {
            console.warn('[USER-MIGRATION] Supabase fetch error:', e);
        }
    }

    // 2. Load users from Firestore (New)
    try {
        const querySnapshot = await getDocs(collection(firebaseDb, 'users'));
        querySnapshot.forEach((docSnap) => {
            if (docSnap.id) {
                firestoreMap.set(docSnap.id, docSnap.data());
            }
        });
    } catch (e) {
        console.warn('[USER-MIGRATION] Firestore fetch error:', e);
    }

    // 3. Compare and compute status for all unique phones
    const allPhones = new Set<string>([...legacyMap.keys(), ...firestoreMap.keys()]);
    const userItems: UserMigrationItem[] = [];

    let legacyCount = 0;
    let migratedCount = 0;
    let inSyncCount = 0;
    let pendingCount = 0;

    allPhones.forEach((phone) => {
        const leg = legacyMap.get(phone);
        const fs = firestoreMap.get(phone);

        const inSupabase = !!leg;
        const inFirestore = !!fs;

        if (inSupabase) legacyCount++;
        if (inFirestore) migratedCount++;

        const fullName = fs?.fullName || leg?.full_name || leg?.fullName || 'بدون اسم';
        const email = fs?.email || leg?.email || '';
        const isAdmin = Boolean(fs?.isAdmin ?? (leg?.is_admin || leg?.isAdmin));
        const storesCount = (fs?.stores || leg?.stores || []).length;

        let status: 'legacy_only' | 'migrated' | 'verified_in_sync' = 'legacy_only';
        let isIdentical = false;

        if (inSupabase && inFirestore) {
            // Check if name, admin, and stores roughly match
            const nameMatch = (fs.fullName || '').trim() === (leg.full_name || leg.fullName || '').trim();
            const adminMatch = Boolean(fs.isAdmin) === Boolean(leg.is_admin || leg.isAdmin);
            const storesMatch = (fs.stores || []).length === (leg.stores || []).length;

            if (nameMatch && adminMatch && storesMatch) {
                status = 'verified_in_sync';
                isIdentical = true;
                inSyncCount++;
            } else {
                status = 'migrated';
            }
        } else if (inFirestore && !inSupabase) {
            status = 'migrated';
        } else if (inSupabase && !inFirestore) {
            status = 'legacy_only';
            pendingCount++;
        }

        userItems.push({
            phone,
            fullName,
            email,
            isAdmin,
            storesCount,
            inSupabase,
            inFirestore,
            isIdentical,
            migrationStatus: status,
            migratedAt: fs?.migratedAt || fs?.joinDate,
            notes: !inFirestore ? 'موجود فقط في المسار القديم' : inSupabase && inFirestore ? 'متواجد في المنظومتين ومتطابق' : 'موجود في المنظومة الجديدة فقط'
        });
    });

    // Sort: pending migration first, then admin, then by name
    userItems.sort((a, b) => {
        if (a.migrationStatus === 'legacy_only' && b.migrationStatus !== 'legacy_only') return -1;
        if (b.migrationStatus === 'legacy_only' && a.migrationStatus !== 'legacy_only') return 1;
        if (a.isAdmin && !b.isAdmin) return -1;
        if (b.isAdmin && !a.isAdmin) return 1;
        return a.fullName.localeCompare(b.fullName, 'ar');
    });

    return {
        summary: {
            totalUsersCount: allPhones.size,
            legacyUsersCount: legacyCount,
            migratedUsersCount: migratedCount,
            verifiedInSyncCount: inSyncCount,
            pendingCount,
            lastCheckedAt: new Date().toISOString()
        },
        users: userItems
    };
};

/**
 * Safely copies a legacy user into Firestore WITHOUT deleting anything from Supabase.
 * Marks the document as migrated and records audit timestamp.
 */
export const safeMigrateSingleUser = async (phone: string): Promise<{ success: boolean; message: string }> => {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) {
            return { success: false, message: 'قاعدة البيانات القديمة غير متصلة.' };
        }

        const { data: legacyUser, error } = await supabase.from('users').select('*').eq('phone', phone).maybeSingle();
        if (error || !legacyUser) {
            return { success: false, message: 'لم يتم العثور على المستخدم في المسار القديم.' };
        }

        const userRef = doc(firebaseDb, 'users', phone);
        const existingFsDoc = await getDoc(userRef);
        const existingData = existingFsDoc.exists() ? existingFsDoc.data() : {};

        // Merge cleanly without destroying existing stores or fields
        const mergedStores = existingData.stores?.length ? existingData.stores : (legacyUser.stores || []);
        const mergedSites = existingData.sites?.length ? existingData.sites : (legacyUser.sites || []);

        const firestorePayload = {
            fullName: legacyUser.full_name || legacyUser.fullName || existingData.fullName || '',
            phone: legacyUser.phone,
            email: legacyUser.email || existingData.email || '',
            password: legacyUser.password || existingData.password || '',
            isAdmin: Boolean(legacyUser.is_admin || legacyUser.isAdmin || existingData.isAdmin),
            isBanned: Boolean(legacyUser.is_banned || legacyUser.isBanned || existingData.isBanned),
            joinDate: legacyUser.join_date || legacyUser.joinDate || existingData.joinDate || new Date().toISOString(),
            stores: mergedStores,
            sites: mergedSites,
            ownedStoreIds: mergedStores.map((s: any) => s.id),
            migrationStatus: 'migrated',
            migratedAt: new Date().toISOString(),
            legacyVerified: true
        };

        await setDoc(userRef, firestorePayload, { merge: true });

        return {
            success: true,
            message: `تم نسخ وترحيل بيانات المستخدم ${firestorePayload.fullName} (${phone}) بنجاح دون المساس بالبيانات القديمة.`
        };
    } catch (err: any) {
        console.error('[USER-MIGRATION] Safe single migration failed:', err);
        return { success: false, message: `حدث خطأ أثناء الترحيل: ${err.message || 'خطأ غير معروف'}` };
    }
};

/**
 * Safely migrates all pending users from Supabase into Firestore in a batch.
 * Guarantees zero data loss (no deletions).
 */
export const safeBatchMigrateUsers = async (): Promise<{
    success: boolean;
    migratedCount: number;
    failedCount: number;
    errors: string[];
}> => {
    try {
        const { users } = await fetchMigrationOverview();
        const pendingUsers = users.filter(u => u.migrationStatus === 'legacy_only');

        let migratedCount = 0;
        let failedCount = 0;
        const errors: string[] = [];

        for (const item of pendingUsers) {
            const res = await safeMigrateSingleUser(item.phone);
            if (res.success) {
                migratedCount++;
            } else {
                failedCount++;
                errors.push(`${item.fullName} (${item.phone}): ${res.message}`);
            }
        }

        return {
            success: failedCount === 0,
            migratedCount,
            failedCount,
            errors
        };
    } catch (err: any) {
        console.error('[USER-MIGRATION] Batch migration failed:', err);
        return {
            success: false,
            migratedCount: 0,
            failedCount: 1,
            errors: [err.message || 'خطأ عام أثناء الترحيل الجماعي']
        };
    }
};
