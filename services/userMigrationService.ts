import { cfFetch } from './cloudflareClient';
import { getLocal, getAllUsers, saveUser } from './databaseService';
import { User } from '../types';

export interface UserMigrationItem {
    phone: string;
    fullName: string;
    email: string;
    isAdmin: boolean;
    storesCount: number;
    inLocalCache: boolean;
    inCloudflareD1: boolean;
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
 * Compares locally cached / IndexedDB users against Cloudflare D1 users
 * to guarantee every user & store profile is safely synced on Cloudflare.
 */
export const fetchMigrationOverview = async (): Promise<{
    summary: MigrationSummary;
    users: UserMigrationItem[];
}> => {
    const localMap = new Map<string, any>();
    const cloudflareMap = new Map<string, any>();

    // 1. Load locally cached users (IndexedDB / localStorage session)
    try {
        const localGlobal = await getLocal('global_users');
        if (Array.isArray(localGlobal)) {
            localGlobal.forEach((item: any) => {
                if (item?.phone) localMap.set(String(item.phone), item);
            });
        }
        if (typeof localStorage !== 'undefined') {
            const curRaw = localStorage.getItem('current_user') || localStorage.getItem('cf_auth_user');
            if (curRaw) {
                const parsed = JSON.parse(curRaw);
                if (parsed?.phone) localMap.set(String(parsed.phone), parsed);
            }
        }
    } catch (e) {
        console.warn('[USER-SYNC] Local cache read error:', e);
    }

    // 2. Load users from Cloudflare D1 (/api/db/users)
    try {
        const cfUsers = await getAllUsers();
        if (Array.isArray(cfUsers)) {
            cfUsers.forEach((u: any) => {
                if (u?.phone) cloudflareMap.set(String(u.phone), u);
            });
        }
    } catch (e) {
        console.warn('[USER-SYNC] Cloudflare D1 fetch error:', e);
    }

    // 3. Compare all known phones
    const allPhones = new Set<string>([...localMap.keys(), ...cloudflareMap.keys()]);
    const userItems: UserMigrationItem[] = [];

    let localCount = 0;
    let cloudCount = 0;
    let inSyncCount = 0;
    let pendingCount = 0;

    allPhones.forEach((phone) => {
        const loc = localMap.get(phone);
        const cf = cloudflareMap.get(phone);

        const inLocalCache = !!loc;
        const inCloudflareD1 = !!cf;

        if (inLocalCache) localCount++;
        if (inCloudflareD1) cloudCount++;

        const fullName = cf?.fullName || loc?.fullName || 'بدون اسم';
        const email = cf?.email || loc?.email || '';
        const isAdmin = Boolean(cf?.isAdmin ?? loc?.isAdmin);
        const storesCount = (cf?.stores || loc?.stores || []).length;

        let status: 'legacy_only' | 'migrated' | 'verified_in_sync' = 'legacy_only';
        let isIdentical = false;

        if (inLocalCache && inCloudflareD1) {
            const nameMatch = (cf.fullName || '').trim() === (loc.fullName || '').trim();
            const adminMatch = Boolean(cf.isAdmin) === Boolean(loc.isAdmin);
            const storesMatch = (cf.stores || []).length === (loc.stores || []).length;

            if (nameMatch && adminMatch && storesMatch) {
                status = 'verified_in_sync';
                isIdentical = true;
                inSyncCount++;
            } else {
                status = 'migrated';
            }
        } else if (inCloudflareD1 && !inLocalCache) {
            status = 'verified_in_sync';
            isIdentical = true;
            inSyncCount++;
        } else if (inLocalCache && !inCloudflareD1) {
            status = 'legacy_only';
            pendingCount++;
        }

        userItems.push({
            phone,
            fullName,
            email,
            isAdmin,
            storesCount,
            inLocalCache,
            inCloudflareD1,
            isIdentical,
            migrationStatus: status,
            migratedAt: cf?.migratedAt || cf?.joinDate,
            notes: !inCloudflareD1
                ? 'موجود محلياً فقط وبانتظار الرفع لـ Cloudflare D1'
                : 'محفوظ ومتزامن على قاعدة بيانات Cloudflare D1'
        });
    });

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
            legacyUsersCount: localCount,
            migratedUsersCount: cloudCount,
            verifiedInSyncCount: inSyncCount,
            pendingCount,
            lastCheckedAt: new Date().toISOString()
        },
        users: userItems
    };
};

/**
 * Uploads a locally cached user safely into Cloudflare D1.
 */
export const safeMigrateSingleUser = async (phone: string): Promise<{ success: boolean; message: string }> => {
    try {
        const localGlobal = await getLocal('global_users');
        const list = Array.isArray(localGlobal) ? localGlobal : [];
        const localUser = list.find((u: any) => String(u?.phone) === String(phone));
        if (!localUser) {
            return { success: false, message: 'لم يتم العثور على المستخدم في الذاكرة المحلية.' };
        }

        await saveUser(localUser as User);
        await cfFetch(`/api/db/users/${encodeURIComponent(phone)}`, {
            method: 'PUT',
            body: JSON.stringify({
                user: {
                    ...localUser,
                    migratedAt: new Date().toISOString()
                }
            })
        }).catch(() => null);

        return {
            success: true,
            message: `تم حفظ ومزامنة حساب ${localUser.fullName || phone} على Cloudflare D1 بنجاح.`
        };
    } catch (err: any) {
        console.error('[USER-SYNC] Safe single sync failed:', err);
        return { success: false, message: `حدث خطأ أثناء المزامنة: ${err.message || 'خطأ غير معروف'}` };
    }
};

/**
 * Syncs all pending local users to Cloudflare D1 in sequence.
 */
export const safeBatchMigrateUsers = async (): Promise<{
    success: boolean;
    migratedCount: number;
    failedCount: number;
    errors: string[];
}> => {
    try {
        const { users } = await fetchMigrationOverview();
        const pendingUsers = users.filter((u) => u.migrationStatus === 'legacy_only');

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
        console.error('[USER-SYNC] Batch sync failed:', err);
        return {
            success: false,
            migratedCount: 0,
            failedCount: 1,
            errors: [err.message || 'خطأ عام أثناء المزامنة الجماعية']
        };
    }
};
