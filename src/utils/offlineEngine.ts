import Dexie, { Table } from 'dexie';

export interface AuditAction {
    id?: number;
    auditId: string;
    itemKey: string;
    action: 'count' | 'note' | 'photo' | 'verify';
    value: any;
    timestamp: number;
    synced: boolean;
    userId: string;
}

export interface CachedAudit {
    id: string;
    data: any;
    lastUpdated: number;
}

class AuditOfflineEngine extends Dexie {
    actions!: Table<AuditAction, number>;
    cachedAudits!: Table<CachedAudit, string>;

    constructor() {
        super('AuditOfflineEngine');
        this.version(1).stores({
            actions: '++id, auditId, itemKey, action, synced, timestamp',
            cachedAudits: 'id, lastUpdated'
        });
    }
}

export const offlineDb = new AuditOfflineEngine();

// Background Sync Simulation
export const syncOfflineActions = async () => {
    const pendingActions = await offlineDb.actions.where('synced').equals(0).toArray();
    
    if (pendingActions.length === 0) return { success: true, count: 0 };
    
    // Simulate network delay and batch processing
    return new Promise<{ success: boolean; count: number }>((resolve) => {
        setTimeout(async () => {
            // In a real app, send to backend here.
            
            // Mark as synced locally
            const ids = pendingActions.map(a => a.id!);
            await offlineDb.actions.bulkUpdate(ids.map(id => ({ key: id, changes: { synced: true } })));
            
            resolve({ success: true, count: pendingActions.length });
        }, 1500);
    });
};
