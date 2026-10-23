/**
 * Sync Integrity, Conflict Resolution, Collision-Free IDs & Password Hardening
 * Addresses Audit Findings #2, #3, #4, #5, #8, #9, and #10.
 */

export type SyncResultStatus = 'committed' | 'pending_sync' | 'failed' | 'conflict';

export interface SaveStoreDataResult {
  success: boolean;
  status: SyncResultStatus;
  operationId: string;
  error?: string;
  failedCollections?: string[];
  conflicts?: Array<{
    collection: string;
    docId: string;
    reason: string;
    cloudUpdatedAt?: string;
    localUpdatedAt?: string;
  }>;
}

export const IMMUTABLE_LEDGER_COLLECTIONS = new Set([
  'transactions',
  'treasury_transactions',
  'partner_transactions'
]);

/**
 * Generates a collision-free unique primary ID for orders and transactions.
 * Fixes Audit Issue #8: Replaces `ORD-M${Date.now().toString().slice(-6)}` which repeats every 16m40s.
 */
export function generateUniqueOrderId(prefix = 'ord'): string {
  const ts = Date.now().toString(36);
  let randomPart = '';
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    randomPart = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  } else {
    randomPart =
      Math.random().toString(36).substring(2, 10) +
      Math.random().toString(36).substring(2, 6);
  }
  return `${prefix}_${ts}_${randomPart}`;
}

/**
 * Generates a human-readable, collision-resistant display orderNumber
 * separate from the internal record ID.
 */
export function generateDisplayOrderNumber(prefix = 'ORD-M'): string {
  const now = new Date();
  const ymd =
    String(now.getUTCFullYear()).slice(-2) +
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    String(now.getUTCDate()).padStart(2, '0');
  const timePart = String(Date.now()).slice(-5);
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${ymd}-${timePart}${rand}`;
}

/**
 * Determines whether a cloud document should be deleted.
 * Fixes Audit Issue #2: Inferred deletion from missing array elements (`wasKnownLocally && isMissingLocally`)
 * is strictly forbidden. Deletion requires an explicit, authorized delete command (`isExplicitlyDeleted`),
 * and financial ledger collections cannot be physically deleted (must use reversal entries).
 */
export function shouldDeleteCloudRecord(params: {
  collectionName: string;
  isExplicitlyDeleted: boolean;
  wasKnownLocally?: boolean;
  isMissingLocally?: boolean;
}): { allowDelete: boolean; reason: string } {
  const { collectionName, isExplicitlyDeleted } = params;

  if (IMMUTABLE_LEDGER_COLLECTIONS.has(collectionName)) {
    return {
      allowDelete: false,
      reason: 'IMMUTABLE_FINANCIAL_LEDGER_REQUIRES_REVERSAL_ENTRY'
    };
  }

  if (!isExplicitlyDeleted) {
    return {
      allowDelete: false,
      reason: 'INFERRED_DELETION_DISABLED'
    };
  }

  return {
    allowDelete: true,
    reason: 'EXPLICIT_AUTHORIZED_DELETE'
  };
}

/**
 * Evaluates whether a local item should update an existing cloud record.
 * Fixes Audit Issue #3: Compares version & original `updatedAt` BEFORE stamping the local item
 * with `nowISO`, preventing stale local state from overwriting a newer cloud update.
 */
export function evaluateRecordUpsert(params: {
  localItem: Record<string, any>;
  existingCloudDoc?: Record<string, any> | null;
  conflictStrategy?: 'last_write_wins' | 'cloud_wins' | 'local_wins';
  nowISO?: string;
}): {
  shouldUpdateCloud: boolean;
  isConflict: boolean;
  conflictReason?: string;
  itemToWrite: Record<string, any>;
} {
  const {
    localItem,
    existingCloudDoc,
    conflictStrategy = 'last_write_wins',
    nowISO = new Date().toISOString()
  } = params;

  const itemCopy = { ...localItem };

  // Brand-new document on cloud
  if (!existingCloudDoc) {
    if (!itemCopy.updatedAt) {
      itemCopy.updatedAt = nowISO;
    }
    itemCopy.version = Number(itemCopy.version || 1);
    return {
      shouldUpdateCloud: true,
      isConflict: false,
      itemToWrite: itemCopy
    };
  }

  // Check if substantive fields changed (ignoring metadata fields)
  const fieldsChanged = Object.keys(localItem).some(k => {
    if (['id', 'storeId', 'store_id', 'updatedAt', 'updated_at', 'version', '_ref'].includes(k)) {
      return false;
    }
    const val1 = localItem[k];
    const val2 = existingCloudDoc[k];
    if (typeof val1 === 'object' && val1 !== null && typeof val2 === 'object' && val2 !== null) {
      return JSON.stringify(val1) !== JSON.stringify(val2);
    }
    return val1 !== val2;
  });

  if (!fieldsChanged) {
    return {
      shouldUpdateCloud: false,
      isConflict: false,
      itemToWrite: itemCopy
    };
  }

  if (conflictStrategy === 'cloud_wins') {
    return {
      shouldUpdateCloud: false,
      isConflict: true,
      conflictReason: 'CLOUD_WINS_POLICY',
      itemToWrite: itemCopy
    };
  }

  // Compare versions & original timestamps BEFORE stamping `nowISO`
  const cloudVersion = Number(existingCloudDoc.version || 0);
  const localVersion = Number(localItem.version || 0);

  if (conflictStrategy !== 'local_wins') {
    if (cloudVersion > 0 && localVersion > 0 && cloudVersion > localVersion) {
      return {
        shouldUpdateCloud: false,
        isConflict: true,
        conflictReason: `VERSION_CONFLICT_CLOUD_V${cloudVersion}_GT_LOCAL_V${localVersion}`,
        itemToWrite: itemCopy
      };
    }

    if (existingCloudDoc.updatedAt) {
      const cloudTime = new Date(existingCloudDoc.updatedAt).getTime();
      const localOriginalTime = localItem.updatedAt
        ? new Date(localItem.updatedAt).getTime()
        : 0;

      // If local item had an older timestamp (or no timestamp while cloud already had a newer timestamp)
      if (Number.isFinite(cloudTime) && cloudTime > 0) {
        if (!localOriginalTime || cloudTime > localOriginalTime) {
          return {
            shouldUpdateCloud: false,
            isConflict: true,
            conflictReason: `STALE_LOCAL_TIMESTAMP_${localItem.updatedAt || 'NONE'}_LT_CLOUD_${existingCloudDoc.updatedAt}`,
            itemToWrite: itemCopy
          };
        }
      }
    }
  }

  // Local item is genuinely at or ahead of the cloud base version/time; stamp new timestamp and increment version
  itemCopy.updatedAt = nowISO;
  itemCopy.version = Math.max(cloudVersion, localVersion) + 1;

  return {
    shouldUpdateCloud: true,
    isConflict: false,
    itemToWrite: itemCopy
  };
}

/**
 * Reconciles orders between `stores_data.orders` (embedded) and `orders` collection (relational)
 * by ID without losing any record from either source, reporting any field discrepancies.
 * Fixes Audit Issue #5.
 */
export function reconcileDualOrderSources(
  storeId: string,
  embeddedOrders: any[],
  collectionOrders: any[]
): {
  mergedOrders: any[];
  onlyInEmbeddedIds: string[];
  onlyInCollectionIds: string[];
  conflicts: Array<{ orderId: string; embeddedStatus: string; collectionStatus: string }>;
} {
  const safeEmbedded = Array.isArray(embeddedOrders) ? embeddedOrders : [];
  const safeCollection = Array.isArray(collectionOrders) ? collectionOrders : [];

  const normalizeId = (rawId: any): string => {
    const s = String(rawId || '').trim();
    return s.startsWith(`${storeId}_`) ? s.slice(storeId.length + 1) : s;
  };

  const embeddedMap = new Map<string, any>();
  for (const o of safeEmbedded) {
    const id = normalizeId(o?.id);
    if (id) embeddedMap.set(id, { ...o, id });
  }

  const collectionMap = new Map<string, any>();
  for (const o of safeCollection) {
    const id = normalizeId(o?.id);
    if (id) collectionMap.set(id, { ...o, id });
  }

  const onlyInEmbeddedIds: string[] = [];
  const onlyInCollectionIds: string[] = [];
  const conflicts: Array<{ orderId: string; embeddedStatus: string; collectionStatus: string }> = [];
  const mergedMap = new Map<string, any>();

  for (const [id, emb] of embeddedMap.entries()) {
    if (!collectionMap.has(id)) {
      onlyInEmbeddedIds.push(id);
      mergedMap.set(id, emb);
    } else {
      const col = collectionMap.get(id);
      if (emb.status !== col.status) {
        conflicts.push({
          orderId: id,
          embeddedStatus: String(emb.status || ''),
          collectionStatus: String(col.status || '')
        });
      }
      const embTime = new Date(emb.updatedAt || emb.confirmedAt || emb.date || 0).getTime();
      const colTime = new Date(col.updatedAt || col.confirmedAt || col.date || 0).getTime();
      const embVer = Number(emb.version || 0);
      const colVer = Number(col.version || 0);

      if (embVer > colVer || (embVer === colVer && embTime >= colTime)) {
        mergedMap.set(id, { ...col, ...emb, id });
      } else {
        mergedMap.set(id, { ...emb, ...col, id });
      }
    }
  }

  for (const [id, col] of collectionMap.entries()) {
    if (!embeddedMap.has(id)) {
      onlyInCollectionIds.push(id);
      mergedMap.set(id, col);
    }
  }

  const mergedOrders = Array.from(mergedMap.values()).sort((a, b) => {
    const tA = new Date(a.createdAt || a.date || 0).getTime();
    const tB = new Date(b.createdAt || b.date || 0).getTime();
    return tB - tA;
  });

  return {
    mergedOrders,
    onlyInEmbeddedIds,
    onlyInCollectionIds,
    conflicts
  };
}

/**
 * Deterministic, Browser & Node-compatible Password Hashing (SHA-256 with salt)
 * Fixes Audit Issue #10: Eliminates storing plaintext passwords in `users` documents.
 */
export async function hashPasswordSecure(plainPassword: string, existingSalt?: string): Promise<string> {
  if (plainPassword.startsWith('sha256$')) return plainPassword;
  const salt =
    existingSalt ||
    Math.random().toString(36).substring(2, 10) +
      Math.random().toString(36).substring(2, 10);

  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${plainPassword}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `sha256$${salt}$${hashHex}`;
}

export async function verifyPasswordSecure(
  candidatePlain: string,
  storedPassword?: string | null
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!storedPassword || !candidatePlain) {
    return { valid: false, needsRehash: false };
  }
  if (storedPassword.startsWith('sha256$')) {
    const parts = storedPassword.split('$');
    if (parts.length !== 3) return { valid: false, needsRehash: false };
    const salt = parts[1];
    const expectedHash = await hashPasswordSecure(candidatePlain, salt);
    return {
      valid: expectedHash === storedPassword,
      needsRehash: false
    };
  }
  // Legacy plaintext fallback for non-destructive migration; flags `needsRehash: true`
  const matchesLegacy = storedPassword === candidatePlain;
  return {
    valid: matchesLegacy,
    needsRehash: matchesLegacy
  };
}
